class UserFacingError(Exception):
    """Its message is safe to show to the Discord user as is."""


class BackendError(UserFacingError):
    """A failed call to the CodeTerra backend."""


class InputError(UserFacingError):
    """The user gave something we can't use (a bad link, a bad date...)."""
