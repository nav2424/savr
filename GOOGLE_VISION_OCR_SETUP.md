# Google Cloud Vision OCR Setup Guide

## Overview

This implementation adds Google Cloud Vision API OCR for reliable receipt scanning. The OCR extracts text from receipt images, which is then parsed deterministically to extract subtotal, tax, and total values.

## Architecture

1. **Client (React Native/Expo)**: Captures receipt image, preprocesses it, sends to server
2. **Server (Node.js/Express)**: Receives image, calls Google Cloud Vision API, returns text
3. **Parser**: Deterministically extracts totals from OCR text (no LLM for totals)

## Setup Instructions

### 1. Install Dependencies

**Server:**
```bash
cd server
npm install @google-cloud/vision
```

**Client:**
```bash
npm install expo-image-manipulator
```

### 2. Get Google Cloud Vision API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project
3. Enable "Cloud Vision API" in APIs & Services
4. Go to Credentials → Create Credentials → API Key
5. Copy the API key

### 3. Configure Environment Variables

**Server (.env file):**
```bash
GOOGLE_CLOUD_VISION_API_KEY=your_api_key_here
PORT=3000
```

**Client (EAS Secrets for production):**
```bash
# No client-side API key needed - OCR is server-side only
```

### 4. Start Server

```bash
cd server
npm start
```

## API Endpoints

### POST /api/ocr

**Request:**
```json
{
  "imageBase64": "base64_encoded_image_string"
}
```

**Response (Success):**
```json
{
  "text": "extracted OCR text...",
  "provider": "google-vision",
  "textLength": 1234
}
```

**Response (Failure):**
```json
{
  "error": "ocr_failed",
  "message": "OCR returned insufficient text"
}
```

## Image Preprocessing

The client automatically preprocesses images before sending to OCR:
- Resizes to 2000px width (maintains aspect ratio)
- Sets JPEG quality to 1.0 (maximum)
- Uses `expo-image-manipulator` for processing

## Totals Parsing

The parser extracts totals from OCR text using deterministic rules:

1. **Walmart Format:**
   - SUBTOTAL → extracts last currency value
   - TAX 10.000% → extracts tax rate and amount
   - TOTAL → extracts last currency value

2. **Costco Format:**
   - Identifies multiple total blocks
   - Selects FIRST complete block before "EXECUTIVE REBATE"
   - Ignores rebate-adjusted totals

## Logging

The system logs:
- OCR success/failure
- Text length extracted
- Totals extracted (subtotal, tax, total)
- Selected totals block index (for Costco)

Example logs:
```
✅ Google Vision OCR success: 1234 characters extracted
✅ OCR text extracted, parsing totals...
📊 Totals extracted from OCR: {
  receiptSubtotal: 90.91,
  receiptTax: 9.09,
  receiptTotal: 100.00,
  selectedTotalsBlockIndex: 0
}
```

## Fallback Behavior

1. **Google Vision fails** → Falls back to Tesseract.js
2. **OCR fails completely** → Falls back to LLM-only mode (needsReview=true)
3. **OCR succeeds but totals missing** → Marks needsReview=true, keeps OCR text for debugging

## Testing

Test with Walmart receipt:
- Should extract: subtotal 90.91, tax 9.09, total 100.00

Test with Costco receipt:
- Should extract: subtotal 461.80, tax 6.89, total 468.69 (first block, ignores rebate)

## Troubleshooting

**"Google Vision not initialized"**
- Check `GOOGLE_CLOUD_VISION_API_KEY` is set in server .env
- Verify API key is valid
- Check Cloud Vision API is enabled in Google Cloud Console

**"OCR returned insufficient text"**
- Image may be too blurry or low quality
- Try better lighting when capturing receipt
- Check image preprocessing is working (should resize to 2000px)

**"Totals missing"**
- OCR text may not contain SUBTOTAL/TAX/TOTAL keywords
- Check OCR text in logs to verify extraction
- Receipt may have non-standard format
