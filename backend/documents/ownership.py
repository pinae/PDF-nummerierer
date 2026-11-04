"""Who owns a document: a random token stored inside the browser session.

Binding to a token in the session data (instead of the session key) lets us
rotate the session key on the first upload, so a session cookie planted in
the browser beforehand (session fixation) never leads to the exam.
"""

import secrets

OWNER_SESSION_KEY = "pdfnum_owner"


def current_owner(request) -> str | None:
    return request.session.get(OWNER_SESSION_KEY)


def claim_owner(request) -> str:
    owner = current_owner(request)
    if owner is None:
        request.session.cycle_key()
        owner = secrets.token_urlsafe(32)
        request.session[OWNER_SESSION_KEY] = owner
    return owner
