"""
PDF text extraction built on pdfplumber.

Raises PDFExtractionError with a HUMAN-READABLE message for every failure
mode (empty file, corrupted/encrypted PDF, scanned-images-only PDF) so the
route layer can forward it straight to the frontend.
"""

import io

import pdfplumber

MIN_TEXT_CHARS = 50       # below this, treat as "no extractable text"
MAX_PROMPT_CHARS = 60000  # generous context budget for the LLM prompt


class PDFExtractionError(Exception):
    """Raised when a PDF cannot be opened or contains no usable text."""


def extract_text_from_pdf(file_stream, max_chars: int = MAX_PROMPT_CHARS) -> str:
    """Read a file-like object and return its extracted text.

    Args:
        file_stream: any binary file-like object (Werkzeug's FileStorage.stream works).
        max_chars:   silently truncate longer documents rather than fail.

    Raises:
        PDFExtractionError: with a specific, user-actionable message.
    """
    try:
        data = file_stream.read()
    except Exception as exc:
        raise PDFExtractionError("Could not read the uploaded file.") from exc

    if not data:
        raise PDFExtractionError("The uploaded file is empty.")

    # pdfplumber.open accepts a path or a file-like object; BytesIO decouples
    # us from wherever Werkzeug spooled the upload.
    try:
        with pdfplumber.open(io.BytesIO(data)) as pdf:
            if len(pdf.pages) == 0:
                raise PDFExtractionError("The PDF has no pages.")
            full_text = "".join(
                page.extract_text() or "" for page in pdf.pages
            )
    except PDFExtractionError:
        raise
    except Exception as exc:
        # pdfplumber raises PdfPasswordError for encrypted files and
        # generic exceptions for corrupt / non-PDF data.
        raise PDFExtractionError(
            "The file could not be read as a PDF "
            "(it may be corrupted, password-protected, or not a PDF at all)."
        ) from exc

    if len(full_text.strip()) < MIN_TEXT_CHARS:
        raise PDFExtractionError(
            "No extractable text found — this PDF looks like scanned images. "
            "OCR is not supported; try a text-based PDF."
        )

    return full_text[:max_chars]
