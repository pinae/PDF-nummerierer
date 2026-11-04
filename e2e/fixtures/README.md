# E2E fixtures

`exam.pdf`: three A4 pages ("This is page 1" …), generated with
`stamping.tests.pdfs.three_page_exam()` from the backend (port of the original
`create_dummy.py`). Regenerate with:

    cd backend && uv run python -c "from stamping.tests.pdfs import three_page_exam; open('../e2e/fixtures/exam.pdf', 'wb').write(three_page_exam())"

`rotated.pdf`: one A4 page with `/Rotate 90` and a crop box offset from the
media box (20, 30, 575, 820), for the preview-equals-output test. Regenerate with:

    cd backend && uv run python -c "from stamping.tests.pdfs import make_pdf, PageSpec; open('../e2e/fixtures/rotated.pdf', 'wb').write(make_pdf(PageSpec(text='Rotated page with offset crop box', rotate=90, cropbox=(20, 30, 575, 820))))"
