import os
import tempfile

# Must be set before the app (and its Store) is imported.
os.environ["CODESENTINEL_DB"] = os.path.join(tempfile.mkdtemp(), "test.db")
