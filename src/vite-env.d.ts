/// <reference types="vite/client" />

declare module '*.hdr' {
  const url: string;
  export default url;
}

declare module '*.wgsl' {
  const text: string;
  export default text;
}
