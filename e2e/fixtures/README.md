# E2E fixtures

`exam.pdf`: three A4 pages ("This is page 1" …), generated with
`stamping.tests.pdfs.three_page_exam()` from the backend (port of the original
`create_dummy.py`). Regenerate with:

    cd backend && uv run python -c "from stamping.tests.pdfs import three_page_exam; open('../e2e/fixtures/exam.pdf', 'wb').write(three_page_exam())"
