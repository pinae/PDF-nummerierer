import pytest

from stamping.errors import UnknownFontError
from stamping.fonts import FONTS, FontCategory, get_font, unsupported_characters


def test_font_list_is_short_but_not_empty():
    assert 1 <= len(FONTS) < 10


def test_font_ids_are_unique():
    ids = [font.id for font in FONTS]

    assert len(ids) == len(set(ids))


def test_every_category_is_offered():
    assert {font.category for font in FONTS} == set(FontCategory)


def test_computer_modern_is_available_as_in_the_original_script():
    font = get_font("cmu-serif")

    assert font.label == "Computer Modern Roman"
    assert font.category is FontCategory.SERIF


@pytest.mark.parametrize("font", FONTS, ids=lambda f: f.id)
def test_font_file_and_license_are_bundled(font):
    assert font.path.is_file()
    assert font.license_path.is_file()


@pytest.mark.parametrize("font", FONTS, ids=lambda f: f.id)
def test_font_renders_digits_and_common_punctuation(font):
    assert unsupported_characters(font.id, "0123456789 -–/#.:()ÄÖÜäöüß") == set()


def test_unsupported_characters_are_reported():
    assert unsupported_characters("caveat", "Nr. 中1") == {"中"}


def test_unknown_font_is_rejected():
    with pytest.raises(UnknownFontError, match="no-such-font"):
        get_font("no-such-font")
