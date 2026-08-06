"""Update vendor assertions for the externalized legacy runtime."""

from pathlib import Path

path = Path("tests/test_vendor_features.py")
source = path.read_text()
source = source.replace(
    "import importlib.util\nimport sys\n",
    "import importlib.util\nimport re\nimport sys\n",
)
marker = '''VENDORED = Path(__file__).resolve().parents[1] / (
    "custom_components/dashboardmodern/frontend/legacy"
)


'''
helper = '''VENDORED = Path(__file__).resolve().parents[1] / (
    "custom_components/dashboardmodern/frontend/legacy"
)


def _variant_source(name: str) -> str:
    """Return the HTML shell plus every local asset it loads directly."""
    html = (VENDORED / name).read_text(encoding="utf-8")
    parts = [html]
    references = re.findall(r'(?:src|href)="\\./([^"?#]+)', html)
    for reference in references:
        asset = VENDORED / reference
        if asset.is_file() and asset.suffix in {".js", ".css", ".html"}:
            parts.append(asset.read_text(encoding="utf-8"))
    return "\\n".join(parts)


'''
if marker not in source:
    raise SystemExit("vendor test insertion marker missing")
source = source.replace(marker, helper, 1)
source = source.replace(
    'html = (VENDORED / name).read_text(encoding="utf-8")',
    'html = _variant_source(name)',
)
source = source.replace(
    'def _variant_source(name: str) -> str:\n'
    '    """Return the HTML shell plus every local asset it loads directly."""\n'
    '    html = _variant_source(name)',
    'def _variant_source(name: str) -> str:\n'
    '    """Return the HTML shell plus every local asset it loads directly."""\n'
    '    html = (VENDORED / name).read_text(encoding="utf-8")',
    1,
)
path.write_text(source)
