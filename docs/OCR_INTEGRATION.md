# OCR Integration for Allergen Detection

When Open Food Facts has no ingredient data (UNKNOWN), users can fall back to **Scan label photo** (OCR) or **Paste ingredients manually**.

## Stub

`lib/ocrStub.ts` exports `runOcr(imageUri: string): Promise<string>` — currently returns empty string.

## Where to plug in real OCR

Replace the stub with one of:

- **Google Cloud Vision** – [OCR docs](https://cloud.google.com/vision/docs/ocr). Use `TEXT_DETECTION` or `DOCUMENT_TEXT_DETECTION`.
- **Apple Vision** – `VNRecognizeTextRequest` for on-device text recognition (iOS).
- **ML Kit Text Recognition** – [docs](https://developers.google.com/ml-kit/vision/text-recognition). Works on-device for iOS and Android.

Flow: capture image → run OCR → get raw text → pass to `detectAllergensEvidenceBased()` via `parseSections()` for section splitting.
