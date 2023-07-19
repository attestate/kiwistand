# Installation & Usage

**Note**: We're using sphinx-multiversion and so only commited changes will
alter the output of `make html`!

```bash
# Create a virtual environment with python3 [1] 
python3 -m venv .venv

# Activate the virtual environment in your shell [1]
source .venv/bin/activate

# Generate the multiversion documentation
make html

# To serve the docs locally
make serve
```

## References

- 1: https://docs.python.org/3/library/venv.html
