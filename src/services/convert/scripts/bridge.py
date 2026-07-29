#!/usr/bin/env python3
import sys
import subprocess
import zipfile
import os
from pathlib import Path


def pdf2img(input_path, output_path, fmt='jpeg'):
    import fitz
    doc = fitz.open(input_path)
    output_dir = Path(output_path).parent
    os.makedirs(output_dir, exist_ok=True)
    base = Path(output_path).stem
    fmt = fmt.lower().replace('jpg', 'jpeg')
    ext = 'png' if fmt == 'png' else 'jpg'

    images = []
    for i, page in enumerate(doc):
        pix = page.get_pixmap(dpi=200)
        page_path = output_dir / f"{base}_page_{i+1}.{ext}"
        pix.save(str(page_path))
        images.append(str(page_path))

    doc.close()

    if len(images) == 1:
        os.rename(images[0], output_path)
    else:
        zip_path = output_path + '.zip'
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
            for img_path in images:
                zf.write(img_path, os.path.basename(img_path))
                os.remove(img_path)
        os.rename(zip_path, output_path)

    print(f"OK:{len(images)}")


def libreoffice_convert(input_path, output_path):
    output_dir = str(Path(output_path).parent)
    result = subprocess.run([
        'libreoffice', '--headless', '--convert-to', 'pdf',
        '--outdir', output_dir, input_path
    ], capture_output=True, text=True, timeout=120)

    if result.returncode != 0:
        print(f"ERROR: {result.stderr.strip()}", file=sys.stderr)
        sys.exit(1)

    input_name = Path(input_path).stem
    expected = Path(output_dir) / f"{input_name}.pdf"
    if expected.exists():
        os.rename(str(expected), output_path)

    print("OK")


if __name__ == '__main__':
    if len(sys.argv) < 4:
        print("ERROR: Usage: bridge.py <action> <input> <output> [format]", file=sys.stderr)
        sys.exit(1)

    action = sys.argv[1]
    input_path = sys.argv[2]
    output_path = sys.argv[3]
    fmt = sys.argv[4] if len(sys.argv) > 4 else 'jpeg'

    try:
        if action == 'pdf2img':
            pdf2img(input_path, output_path, fmt)
        elif action == 'ppt2pdf':
            libreoffice_convert(input_path, output_path)
        elif action == 'docx2pdf':
            libreoffice_convert(input_path, output_path)
        else:
            print(f"ERROR: Unknown action: {action}", file=sys.stderr)
            sys.exit(1)
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)
