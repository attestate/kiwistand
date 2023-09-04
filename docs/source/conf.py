# Configuration file for the Sphinx documentation builder.
#
# For the full list of built-in configuration values, see the documentation:
# https://www.sphinx-doc.org/en/master/usage/configuration.html

# -- Project information -----------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#project-information

project = '@attestate/kiwistand'
copyright = '2023, The Kiwistand Contributors'
author = 'Tim Daubenschütz'

# -- General configuration ---------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#general-configuration

extensions = ['sphinx_multiversion', 'sphinxcontrib.mermaid']

templates_path = ['_templates']
exclude_patterns = []



# -- Options for HTML output -------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#options-for-html-output

html_theme = 'sphinx_rtd_theme'
html_static_path = ['_static']
html_context = {
    "display_github": True,
    "github_user": "attestate",
    "github_repo": "kiwistand",
    "github_version": "main",
    "conf_py_path": "/docs/source/",
}
