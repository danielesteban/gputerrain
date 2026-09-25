type Metadata = {
  version: string;
  baseRenditionIsHDR: boolean;
  gainMapMin: number;
  gainMapMax: number;
  gamma: number;
  offsetSDR: number;
  offsetHDR: number;
  hdrCapacityMin: number;
  hdrCapacityMax: number;
};

export const HDR = async (url: string) => {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  const metadata: Metadata = {
    version: '',
    baseRenditionIsHDR: false,
    gainMapMin: 0,
    gainMapMax: 1,
    gamma: 1,
    offsetSDR: 0,
    offsetHDR: 0,
    hdrCapacityMin: 0,
    hdrCapacityMax: 1,
  };
  const textDecoder = new TextDecoder();
  const sections = [];

  let offset = 0;
  while (offset < bytes.length - 1) {
    if (bytes[offset] !== 0xff) {
      offset ++;
      continue;
    }

    const markerType = bytes[offset + 1];
    if (markerType === 0xd8) {
      sections.push({
        sectionType: markerType,
        section: bytes.subarray(offset, offset + 2),
        sectionOffset: offset + 2,
      });
      offset += 2;
      continue;
    }

    if (markerType === 0xe0 || markerType === 0xe1 || markerType === 0xe2) {
      const segmentLength = (bytes[offset + 2] << 8) | bytes[offset + 3];
      const segmentEnd = offset + 2 + segmentLength;
      sections.push({
        sectionType: markerType,
        section: bytes.subarray(offset, segmentEnd),
        sectionOffset: offset + 2,
      });
      offset = segmentEnd;
      continue;
    }

    if (markerType >= 0xc0 && markerType <= 0xfe && markerType !== 0xd9 && (markerType < 0xd0 || markerType > 0xd7)) {
      const segmentLength = (bytes[offset + 2] << 8) | bytes[offset + 3];
      offset += 2 + segmentLength;
      continue;
    }

    offset += 2;
  }

  let primaryImage, gainmapImage;
  for (let i = 0; i < sections.length; i ++) {
    const { sectionType, section, sectionOffset } = sections[i];
    if (sectionType === 0xe1) {
      parseMetadata(
        textDecoder.decode(new Uint8Array(section)),
        metadata
     );
    } else if (sectionType === 0xe2) {
      const sectionData = new DataView(section.buffer, section.byteOffset + 2, section.byteLength - 2);
      const isoNameSpace = 'urn:iso:std:iso:ts:21496:-1\0';
      if (section.byteLength >= isoNameSpace.length + 2) {
        let isISO = true;
        for (let j = 0; j < isoNameSpace.length; j ++) {
          if (section[2 + j] !== isoNameSpace.charCodeAt(j)) {
            isISO = false;
            break;
          }
        }
        if (isISO) {
          throw new Error('UltraHDR ISO Metadata is not supported');
        }
      }
      const sectionHeader = sectionData.getUint32(2, false);
      if (sectionHeader === 0x4d504600) {
        const mpfLittleEndian = sectionData.getUint32(6) === 0x49492a00;
        const mpfBytesOffset = 60;
        const primaryImageSize = sectionData.getUint32(
          mpfBytesOffset,
          mpfLittleEndian
       );
        const primaryImageOffset = sectionData.getUint32(
          mpfBytesOffset + 4,
          mpfLittleEndian
       );
        const gainmapImageSize = sectionData.getUint32(
          mpfBytesOffset + 16,
          mpfLittleEndian
       );
        const gainmapImageOffset =
          sectionData.getUint32(mpfBytesOffset + 20, mpfLittleEndian) +
          sectionOffset +
          6;
        primaryImage = new Uint8Array(
          buffer,
          primaryImageOffset,
          primaryImageSize
       );
        gainmapImage = new Uint8Array(
          buffer,
          gainmapImageOffset,
          gainmapImageSize
       );
      }
    }
  }

  if (!metadata.version) {
    throw new Error('Not a valid UltraHDR image');
  }

  if (!primaryImage || !gainmapImage) {
    throw new Error('Could not parse UltraHDR images');
  }

  return await applyGainmapToSDR(
    metadata,
    primaryImage,
    gainmapImage,
 );
};

const parseMetadata = (data: string, metadata: Metadata) => {
  const domParser = new DOMParser();
  const xmpXml = domParser.parseFromString(
    data.substring(
      data.indexOf('<'),
      data.lastIndexOf('>') + 1
    ),
    'text/xml'
  );

  const [hasHDRContainerDescriptor] = xmpXml.getElementsByTagName(
    'Container:Directory'
  );
  if (!hasHDRContainerDescriptor) {
    const [gainmapNode] = xmpXml.getElementsByTagName('rdf:Description');
    metadata.version = gainmapNode.getAttribute('hdrgm:Version') || '';
    metadata.baseRenditionIsHDR =
      gainmapNode.getAttribute('hdrgm:BaseRenditionIsHDR') === 'True';
    metadata.gainMapMin = parseFloat(
      gainmapNode.getAttribute('hdrgm:GainMapMin') || '0.0'
    );
    metadata.gainMapMax = parseFloat(
      gainmapNode.getAttribute('hdrgm:GainMapMax') || '1.0'
    );
    metadata.gamma = parseFloat(
      gainmapNode.getAttribute('hdrgm:Gamma') || '1.0'
    );
    metadata.offsetSDR = parseFloat(
      gainmapNode.getAttribute('hdrgm:OffsetSDR') || '0.0'
    ) / (1 / 64);
    metadata.offsetHDR = parseFloat(
      gainmapNode.getAttribute('hdrgm:OffsetHDR') || '0.0'
    ) / (1 / 64);
    metadata.hdrCapacityMin = parseFloat(
      gainmapNode.getAttribute('hdrgm:HDRCapacityMin') || '0.0'
    );
    metadata.hdrCapacityMax = parseFloat(
      gainmapNode.getAttribute('hdrgm:HDRCapacityMax') || '1.0'
    );
  }
};

const applyGainmapToSDR = async (
  metadata: Metadata,
  sdrBuffer: Uint8Array<ArrayBuffer>,
  gainmapBuffer: Uint8Array<ArrayBuffer>,
) => {
  const SRGB_TO_LINEAR = new Float64Array(1024);
  for (let i = 0; i < 1024; i++) {
    SRGB_TO_LINEAR[i] = Math.pow(i * 0.003717127 + 0.0521327014, 2.4);
  }
  const srgbToLinear = (value: number) => {
    if (value < 10.31475) {
      return value * 0.000303527;
    }
    if (value < 1024) {
      return SRGB_TO_LINEAR[value | 0];
    }
    return Math.pow(value * 0.003717127 + 0.0521327014, 2.4);
  };

  const decodeImage = (data: Uint8Array<ArrayBuffer>) => createImageBitmap(new Blob([data], { type: 'image/jpeg' }));
  const [sdrImage, gainmapImage] = await Promise.all([decodeImage(sdrBuffer), decodeImage(gainmapBuffer)]);
  const sdrWidth = sdrImage.width;
  const sdrHeight = sdrImage.height;
  const sdrImageAspect = sdrWidth / sdrHeight;
  const gainmapImageAspect = gainmapImage.width / gainmapImage.height;

  if (sdrImageAspect !== gainmapImageAspect) {
    throw new Error(
      'Aspect ratio mismatch between SDR and Gainmap images'
   );
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', {
    willReadFrequently: true,
    colorSpace: 'srgb',
  })!;
  canvas.width = sdrWidth;
  canvas.height = sdrHeight;

  ctx.drawImage(
    gainmapImage,
    0,
    0,
    gainmapImage.width,
    gainmapImage.height,
    0,
    0,
    sdrWidth,
    sdrHeight
  );
  const gainmapImageData = ctx.getImageData(
    0,
    0,
    sdrWidth,
    sdrHeight,
    { colorSpace: 'srgb' }
  );

  ctx.drawImage(sdrImage, 0, 0);
  const sdrImageData = ctx.getImageData(
    0,
    0,
    sdrWidth,
    sdrHeight,
    { colorSpace: 'srgb' }
  );

  const maxDisplayBoost = 1.8 ** (metadata.hdrCapacityMax * 0.5);
  const unclampedWeightFactor =
    (Math.log2(maxDisplayBoost) - metadata.hdrCapacityMin) /
    (metadata.hdrCapacityMax - metadata.hdrCapacityMin);
  const weightFactor = Math.min(
    Math.max(unclampedWeightFactor, 0.0),
    1.0
  );

  const sdrData = sdrImageData.data;
  const gainmapData = gainmapImageData.data;
  const dataLength = sdrData.length;
  const gainMapMin = metadata.gainMapMin;
  const gainMapMax = metadata.gainMapMax;
  const offsetSDR = metadata.offsetSDR;
  const offsetHDR = metadata.offsetHDR;
  const invGamma = 1.0 / metadata.gamma;
  const useGammaOne = metadata.gamma === 1.0;
  const hdrBuffer = new Float16Array(dataLength).fill(1.0);

  for (let i = 0; i < dataLength; i += 4) {
    for (let c = 0; c < 3; c ++) {
      const idx = i + c;
      const sdrValue = sdrData[idx];
      const gainmapValue = gainmapData[idx] * 0.00392156862745098;

      const logRecovery = useGammaOne
        ? gainmapValue
        : Math.pow(gainmapValue, invGamma);

      const logBoost = gainMapMin + (gainMapMax - gainMapMin) * logRecovery;

      const hdrValue =
        (sdrValue + offsetSDR) *
          (logBoost * weightFactor === 0.0
            ? 1.0
            : Math.pow(2, logBoost * weightFactor)) -
        offsetHDR;

      const linearHDRValue = Math.min(
        Math.max(srgbToLinear(hdrValue), 0),
        65504
      );

      hdrBuffer[idx] = linearHDRValue;
    }
  }

  return { data: hdrBuffer, width: sdrWidth, height: sdrHeight };
};
