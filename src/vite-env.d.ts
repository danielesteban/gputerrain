/// <reference types="vite/client" />

declare module '*.wgsl' {
  const text: string;
  export default text;
}
