"""
Convert Malayalam Bible XML (Zefania format) to JSON for Firebase Realtime DB.

Usage:
    python xml_to_firebase_json.py
    python xml_to_firebase_json.py input.xml output.json
"""

import xml.etree.ElementTree as ET
import json
import sys


def xml_to_firebase_json(xml_path, json_path):
    tree = ET.parse(xml_path)
    root = tree.getroot()

    bible = {}

    for book in root.findall("BIBLEBOOK"):
        book_num = book.get("bnumber")
        book_name = book.get("bname", "")
        book_short = book.get("bsname", "")

        book_data = {
            "name": book_name,
            "shortName": book_short,
            "chapters": {}
        }

        for chapter in book.findall("CHAPTER"):
            ch_num = chapter.get("cnumber")
            verses = {}

            for verse in chapter.findall("VERS"):
                v_num = verse.get("vnumber")
                verses[v_num] = verse.text or ""

            book_data["chapters"]["ch" + ch_num] = verses

        bible["b" + book_num] = book_data

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(bible, f, ensure_ascii=False, indent=2)

    # Print summary
    total_books = len(bible)
    total_chapters = sum(len(b["chapters"]) for b in bible.values())
    total_verses = sum(
        len(ch) for b in bible.values() for ch in b["chapters"].values()
    )
    print(f"Converted: {total_books} books, {total_chapters} chapters, {total_verses} verses")
    print(f"Output: {json_path}")


if __name__ == "__main__":
    xml_file = sys.argv[1] if len(sys.argv) > 1 else "malayalam_bible.xml"
    json_file = sys.argv[2] if len(sys.argv) > 2 else "malayalam_bible.json"
    xml_to_firebase_json(xml_file, json_file)
