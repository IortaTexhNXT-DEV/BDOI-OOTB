# Writing rules for the BrokerVerse OOTB documentation package

Audience: a Philippine non-life insurance broker (management, operations, finance, IT) and the support team that
takes over the system. Publisher: iorta TechNXT. Product: BrokerVerse (OOTB = out-of-the-box version).

Voice
- Plain, precise business English written by a practitioner. Short sentences. Active voice. UK/PH spelling is fine.
- No marketing filler: never "seamless", "robust", "cutting-edge", "leverage", "delve", "comprehensive solution",
  "in today's fast-paced", "unlock", "empower", "elevate", "game-changer", "best-in-class".
- No long dashes (use a comma, colon or full stop), no emojis, no exclamation marks, no rhetorical questions.
- Never mention Claude, Anthropic, OpenAI, ChatGPT, AI assistants, "generated" or "automated writing". The product
  is not described as AI-built. (A product feature that genuinely uses rules or automation can be described as such.)
- Facts only from the code, the configuration, the tests and the run results. Never invent a screen, report, field,
  API, setting or number. Where something is a recommendation or an assumption, say so.
- Use the system's own names for menus, screens, buttons, statuses and settings, exactly as on screen.
- Money in PHP (Philippine peso, written PHP 1,250,000.00). Dates as 03 October 2026.

Source format (rendered into the iorta TechNXT Word template by tools/build_doc.py)
- Front matter between --- lines: title, subtitle, version (1.0), date (03 October 2026), prepared (iorta TechNXT),
  reviewed, approved, acronyms (OOTB=Out of the box; IC=Insurance Commission; ...).
- "# " chapter (numbered automatically, starts on a new page; chapters 1 and 2 are Document Control and Acronyms,
  which the template provides: do not write them), "## " section, "### " sub-section. Do not number headings yourself.
- Paragraphs as plain lines; "- " bullets (two spaces per nested level); "1. " numbered steps;
  pipe tables with a header row (| a | b |, then |---|---|); "<br>" for a line break inside a cell;
  "> " for a note box; ``` for code blocks; ![Caption](absolute/path.png) for images; **bold** and `code` inline.
- Keep table cells short. Wide reference lists (APIs, columns) go into the companion Excel workbook and the
  document summarises them.

Build and check
  cd /home/user/BDOI-OOTB/docs/package/tools
  python3 build_doc.py ../source/<name>.md ../out/<File_Name>.docx
  python3 refresh.py ../out/<File_Name>.docx      (refreshes the contents page, writes the PDF)
Render a few pages to PNG (pdftoppm -r 50 -f N -l M -png file.pdf /tmp/x) and look at them before finishing.
