cmake_minimum_required(VERSION 3.25)

find_package(cmake-bare REQUIRED PATHS node_modules/cmake-bare)
find_package(cmake-fetch REQUIRED PATHS node_modules/cmake-fetch)

project(bare_xdiff C)

# Fetch standalone xdiff library
fetch_package("github:libgit2/xdiff" SOURCE_DIR xdiff_source)

# Create the bare module
add_bare_module(bare_xdiff)

# Add our binding source and xdiff sources
target_sources(
  ${bare_xdiff}
  PRIVATE
    binding.c
    ${xdiff_source}/xdiffi.c
    ${xdiff_source}/xemit.c
    ${xdiff_source}/xhistogram.c
    ${xdiff_source}/xmerge.c
    ${xdiff_source}/xpatience.c
    ${xdiff_source}/xprepare.c
    ${xdiff_source}/xutils.c
)

# Include directories for xdiff headers
target_include_directories(
  ${bare_xdiff}
  PRIVATE
    ${xdiff_source}
)