import { v4 as uuidv4 } from "uuid";
import md5 from "md5";
import { Blob as NodeBlob } from "web-file-polyfill";

export async function read(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Blob([reader.result as ArrayBuffer]));
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export function hash(fileText: string): string {
  return md5(fileText);
}

export function hash_uuid(): string {
  return uuidv4();
}

export async function blobToBase64(
  blob: Blob
): Promise<string | ArrayBuffer | null> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function base64ToBlob(contents: string): Blob {
  const b64Start = "base64,";
  const index = contents.indexOf(b64Start);
  const base64 = contents.substring(index + b64Start.length);
  const binary = Buffer.from(base64, "base64");
  return new NodeBlob([binary]);
}
