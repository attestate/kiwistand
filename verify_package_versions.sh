#!/bin/bash

# This script checks for the presence of specific malicious package versions
# in both the root directory and the src/web frontend directory.

PACKAGES=(
  "ansi-styles@6.2.2"
  "debug@4.4.2"
  "chalk@5.6.1"
  "supports-color@10.2.1"
  "strip-ansi@7.1.1"
  "ansi-regex@6.2.1"
  "wrap-ansi@9.0.1"
  "color-convert@3.1.1"
  "color-name@2.0.1"
  "is-arrayish@0.3.3"
  "slice-ansi@7.1.1"
  "color@5.0.1"
  "color-string@2.1.1"
  "simple-swizzle@0.2.3"
  "supports-hyperlinks@4.1.1"
  "has-ansi@6.0.1"
  "chalk-template@1.1.1"
  "backslash@0.2.1"
)

echo "========================================================"
echo "Verifying package versions in src/web"
echo "If no lines are printed, the malicious version was not found."
echo "========================================================"
echo ""

(
  cd src/web || exit
  for pkg_info in "${PACKAGES[@]}"; do
    pkg_name="${pkg_info%%@*}"
    pkg_version="${pkg_info##*@}"
    echo "--- Checking for: $pkg_info ---"
    npm ls "$pkg_name" | grep --color=always "$pkg_version" || echo "Malicious version not found."
    echo ""
  done
)


echo "========================================================"
echo "Verifying package versions in root"
echo "If no lines are printed, the malicious version was not found."
echo "========================================================"
echo ""


for pkg_info in "${PACKAGES[@]}"; do
  pkg_name="${pkg_info%%@*}"
  pkg_version="${pkg_info##*@}"
  echo "--- Checking for: $pkg_info ---"
  npm ls "$pkg_name" | grep --color=always "$pkg_version" || echo "Malicious version not found."
  echo ""
done

echo "========================================="
echo "Verification complete."
echo "========================================="