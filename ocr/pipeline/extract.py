# import pytesseract, cv2, json, sys
# img = cv2.imread(sys.argv[1])
# gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
# gray = cv2.GaussianBlur(gray, (3,3), 0)
# th = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY+cv2.THRESH_OTSU)[1]
# text = pytesseract.image_to_string(th)
# print(json.dumps({"raw_text": text}))

import pytesseract
from PIL import Image
import json
import re
import sys


# ------------------------------------------------------------
# Cleaning rules for common Tesseract OCR mistakes
# ------------------------------------------------------------

REPLACEMENTS = {
    # KG mistakes
    " K6": " KG",
    "K6 ": "KG ",
    " K9": " KG",
    "K9 ": "KG ",

    # EA mistakes
    " E.A": " EA",
    " E.A ": " EA ",
    " EA.": " EA",

    # Money formatting
    "$ ": "$",
    " .": ".",
    ",": ".",

    # Common receipt mistakes
    "OZ ": "0Z ",  # Weight oz vs letter O
    "0Z ": "0Z ",
}



def clean_string(s: str) -> str:
    """Apply generic cleaning rules to a line of OCR text."""
    for bad, good in REPLACEMENTS.items():
        s = s.replace(bad, good)

    return s


def clean_ocr_text(text: str) -> str:
    """Apply cleaning to full OCR output."""
    lines = text.splitlines()
    cleaned = [clean_string(line) for line in lines]
    return "\n".join(cleaned)


# ------------------------------------------------------------
# OCR runner
# ------------------------------------------------------------

def run_tesseract(image_path: str) -> str:
    """Perform Tesseract OCR with safe defaults."""
    img = Image.open(image_path)

    # Strong configs for receipts
    config = (
        "--psm 6 "   # assume block of text
        "--oem 3 "   # best available engine
        "-c preserve_interword_spaces=1 "
        "-c tessedit_char_whitelist=0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.$:/%-+() "
    )

    text = pytesseract.image_to_string(img, config=config)
    return text


# ------------------------------------------------------------
# MAIN ENTRY
# ------------------------------------------------------------

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No image path provided"}))
        return

    image_path = sys.argv[1]

    # 1. Raw OCR
    raw_text = run_tesseract(image_path)

    # 2. Cleaned text
    cleaned_text = clean_ocr_text(raw_text)

    # 3. Return JSON for FastAPI to read
    print(json.dumps({
        "raw_text": cleaned_text
    }))


if __name__ == "__main__":
    main()
