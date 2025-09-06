cmake_minimum_required(VERSION 3.25)

find_package(cmake-bare REQUIRED PATHS node_modules/cmake-bare)
find_package(cmake-fetch REQUIRED PATHS node_modules/cmake-fetch)

project(bare_xdiff C)

fetch_package("github:libgit2/xdiff" SOURCE_DIR xdiff)

add_bare_module(bare_xdiff)

target_sources(
  ${bare_xdiff}
  PRIVATE
    binding.c
)

target_include_directories(
  ${bare_xdiff}
  PRIVATE
    ${xdiff}
)

target_link_libraries(
  ${bare_xdiff}
  PUBLIC
    xdiff
)
