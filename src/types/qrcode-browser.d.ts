declare module "qrcode/lib/browser" {
  interface QRCodeToDataURLOptions {
    margin?: number;
    width?: number;
  }
  const QRCode: {
    toDataURL(text: string, options?: QRCodeToDataURLOptions): Promise<string>;
  };
  export default QRCode;
}
