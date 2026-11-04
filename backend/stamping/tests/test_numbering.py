import pytest

from stamping.numbering import NumberFormat, format_serial


def test_default_format_is_four_zero_padded_digits_like_the_original_script():
    assert format_serial(NumberFormat(), 1) == "0001"
    assert format_serial(NumberFormat(), 42) == "0042"


def test_prefix_and_suffix_surround_the_number():
    fmt = NumberFormat(prefix="Exam A – ", digits=3, suffix=" (B)")

    assert format_serial(fmt, 7) == "Exam A – 007 (B)"


def test_numbers_wider_than_the_padding_are_not_truncated():
    assert format_serial(NumberFormat(digits=2), 1234) == "1234"


def test_zero_is_a_valid_serial():
    assert format_serial(NumberFormat(digits=1), 0) == "0"


def test_negative_serials_are_rejected():
    with pytest.raises(ValueError, match="negative"):
        format_serial(NumberFormat(), -1)


@pytest.mark.parametrize("digits", [0, -1, 13])
def test_padding_width_is_bounded(digits):
    with pytest.raises(ValueError, match="digits"):
        NumberFormat(digits=digits)


@pytest.mark.parametrize("field", ["prefix", "suffix"])
def test_affixes_must_be_single_line(field):
    with pytest.raises(ValueError, match=field):
        NumberFormat(**{field: "a\nb"})


@pytest.mark.parametrize("field", ["prefix", "suffix"])
def test_affixes_have_a_length_limit(field):
    NumberFormat(**{field: "x" * 40})

    with pytest.raises(ValueError, match=field):
        NumberFormat(**{field: "x" * 41})


def test_serials_of_a_run_are_consecutive():
    fmt = NumberFormat(prefix="#", digits=2)

    assert fmt.serials(start=98, copies=3) == ["#98", "#99", "#100"]
