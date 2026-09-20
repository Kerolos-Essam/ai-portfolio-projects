import json
import re
from pathlib import Path

import pdfplumber


SOURCE = Path(r"D:\Downloads\Telegram Desktop\C++.Primer.5th.Edition_2013.pdf")
DESTINATION = Path(__file__).resolve().parents[1] / "cpp-primer-concepts.js"


def main():
    with pdfplumber.open(SOURCE) as pdf:
        text = "\n".join(
            pdf.pages[index].extract_text(x_tolerance=1, y_tolerance=3) or ""
            for index in range(7, 19)
        )

    pattern = re.compile(
        r"^(?P<number>(?:[1-9]|1[0-9])(?:\.\d+){1,2})\s+"
        r"(?P<title>.+?)\s+(?P<page>\d+)$"
    )
    concepts = {}
    for line in text.splitlines():
        match = pattern.match(line.strip())
        if not match:
            continue
        number = match.group("number")
        title = re.sub(r"(?:\s*\.\s*){2,}$", "", match.group("title")).strip()
        concepts.setdefault(number, {
            "number": number,
            "title": title,
            "page": int(match.group("page")),
        })

    # These headings wrap across TOC lines and therefore need explicit recovery.
    concepts.update({
        "3.2.1": {"number": "3.2.1", "title": "Defining and Initializing strings", "page": 84},
        "5.3.2": {"number": "5.3.2", "title": "The switch Statement", "page": 178},
        "7.1": {"number": "7.1", "title": "Defining Abstract Data Types", "page": 254},
        "15.7": {"number": "15.7", "title": "Constructors and Copy Control", "page": 622},
    })

    chapter_titles = [
        "Getting Started", "Variables and Basic Types", "Strings, Vectors, and Arrays",
        "Expressions", "Statements", "Functions", "Classes", "The IO Library",
        "Sequential Containers", "Generic Algorithms", "Associative Containers",
        "Dynamic Memory", "Copy Control", "Overloaded Operations and Conversions",
        "Object-Oriented Programming", "Templates and Generic Programming",
        "Specialized Library Facilities", "Tools for Large Programs",
        "Specialized Tools and Techniques",
    ]

    def key(item):
        number = item["number"]
        if number == "Preface":
            return (0,)
        return tuple(int(part) for part in number.split("."))

    all_concepts = [{"number": "Preface", "title": "Preface", "page": 0}]
    all_concepts.extend(
        {"number": str(index), "title": title, "page": min(
            item["page"] for item in concepts.values() if item["number"].startswith(f"{index}.")
        )}
        for index, title in enumerate(chapter_titles, 1)
    )
    all_concepts.extend(concepts.values())
    ordered = sorted(all_concepts, key=key)
    payload = json.dumps(ordered, ensure_ascii=False, separators=(",", ":"))
    DESTINATION.write_text(
        "// Generated from the C++ Primer, 5th Edition table of contents.\n"
        f"export const cppPrimerConcepts = {payload};\n",
        encoding="utf-8",
    )
    print(f"Wrote {len(ordered)} concepts to {DESTINATION}")


if __name__ == "__main__":
    main()
