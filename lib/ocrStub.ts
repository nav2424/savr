/**
 * OCR stub - replace with Google Vision / Apple Vision / ML Kit for production.
 *
 * PLUG-IN NOTE:
 * - Google Cloud Vision: https://cloud.google.com/vision/docs/ocr
 * - Apple Vision (VNRecognizeTextRequest): Native iOS text recognition
 * - ML Kit Text Recognition: https://developers.google.com/ml-kit/vision/text-recognition
 *
 * All return raw text from label images. Pass result to allergenEngine for detection.
 */
export async function runOcr(imageUri: string): Promise<string> {
  // Stub: return empty; real implementation would call Vision API
  return ''
}
