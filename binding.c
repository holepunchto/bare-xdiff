#include <assert.h>
#include <bare.h>
#include <js.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <uv.h>

// Include xdiff headers
#include "xdiff.h"

// XDL merge constants (in case not defined in header)
#ifndef XDL_MERGE_MINIMAL
#define XDL_MERGE_MINIMAL 0
#define XDL_MERGE_EAGER 1
#define XDL_MERGE_ZEALOUS 2
#define XDL_MERGE_ZEALOUS_ALNUM 3
#endif

#ifndef XDL_MERGE_FAVOR_OURS
#define XDL_MERGE_FAVOR_OURS 1
#define XDL_MERGE_FAVOR_THEIRS 2
#define XDL_MERGE_FAVOR_UNION 3
#endif

#ifndef XDL_MERGE_DIFF3
#define XDL_MERGE_DIFF3 1
#define XDL_MERGE_ZEALOUS_DIFF3 2
#endif

// Request structure for async operations
typedef struct {
  uv_work_t request;
  js_env_t *env;
  js_ref_t *ctx;
  js_ref_t *callback;
  
  // Input buffers
  void *buf1;
  size_t len1;
  void *buf2;
  size_t len2;
  void *buf3;  // For merge operations
  size_t len3;
  
  // Options
  uint32_t diff_flags;
  int32_t merge_level;
  int32_t merge_favor;
  int32_t merge_style;
  int32_t merge_marker_size;
  
  // Output
  char *result;
  size_t result_len;
  int32_t error_code;
  int32_t conflict_count;  // For merge operations
  
  js_deferred_teardown_t *teardown;
} bare_xdiff_request_t;

// Output buffer for capturing xdiff output
typedef struct {
  char *data;
  size_t len;
  size_t capacity;
} bare_xdiff_output_t;

// Parse diff options from JavaScript object
static uint32_t
parse_diff_options(js_env_t *env, js_value_t *options) {
  uint32_t flags = 0;
  js_value_t *prop;
  bool value;
  
  // Check if options is null or undefined
  js_value_type_t type;
  if (js_typeof(env, options, &type) != 0 || type == js_null || type == js_undefined) {
    return flags;
  }
  
  // ignoreWhitespace
  if (js_get_named_property(env, options, "ignoreWhitespace", &prop) == 0) {
    js_value_type_t prop_type;
    if (js_typeof(env, prop, &prop_type) == 0 && prop_type == js_boolean) {
      if (js_get_value_bool(env, prop, &value) == 0 && value) {
        flags |= XDF_IGNORE_WHITESPACE;
      }
    }
  }
  
  // ignoreWhitespaceChange  
  if (js_get_named_property(env, options, "ignoreWhitespaceChange", &prop) == 0) {
    js_value_type_t prop_type;
    if (js_typeof(env, prop, &prop_type) == 0 && prop_type == js_boolean) {
      if (js_get_value_bool(env, prop, &value) == 0 && value) {
        flags |= XDF_IGNORE_WHITESPACE_CHANGE;
      }
    }
  }
  
  // ignoreWhitespaceAtEol
  if (js_get_named_property(env, options, "ignoreWhitespaceAtEol", &prop) == 0) {
    js_value_type_t prop_type;
    if (js_typeof(env, prop, &prop_type) == 0 && prop_type == js_boolean) {
      if (js_get_value_bool(env, prop, &value) == 0 && value) {
        flags |= XDF_IGNORE_WHITESPACE_AT_EOL;
      }
    }
  }
  
  // ignoreBlankLines
  if (js_get_named_property(env, options, "ignoreBlankLines", &prop) == 0) {
    js_value_type_t prop_type;
    if (js_typeof(env, prop, &prop_type) == 0 && prop_type == js_boolean) {
      if (js_get_value_bool(env, prop, &value) == 0 && value) {
        flags |= XDF_IGNORE_BLANK_LINES;
      }
    }
  }
  
  // algorithm
  if (js_get_named_property(env, options, "algorithm", &prop) == 0) {
    js_value_type_t prop_type;
    if (js_typeof(env, prop, &prop_type) == 0 && prop_type == js_string) {
      size_t length;
      if (js_get_value_string_utf8(env, prop, NULL, 0, &length) == 0) {
        length += 1; /* NULL */
        char *algorithm = malloc(length);
        if (js_get_value_string_utf8(env, prop, (utf8_t*)algorithm, length, NULL) == 0) {
          if (strcmp(algorithm, "patience") == 0) {
            flags |= XDF_PATIENCE_DIFF;
          } else if (strcmp(algorithm, "histogram") == 0) {
            flags |= XDF_HISTOGRAM_DIFF;
          }
        }
        free(algorithm);
      }
    }
  }
  
  return flags;
}

// Parse merge options from JavaScript object
static void
parse_merge_options(js_env_t *env, js_value_t *options, int32_t *level, int32_t *favor, int32_t *style, int32_t *marker_size) {
  js_value_t *prop;
  
  // Set defaults
  *level = XDL_MERGE_MINIMAL;
  *favor = 0;
  *style = 0;
  *marker_size = 7;
  
  // Check if options is null or undefined
  js_value_type_t type;
  if (js_typeof(env, options, &type) != 0 || type == js_null || type == js_undefined) {
    return;
  }
  
  // level
  if (js_get_named_property(env, options, "level", &prop) == 0) {
    js_value_type_t prop_type;
    if (js_typeof(env, prop, &prop_type) == 0 && prop_type == js_string) {
      size_t length;
      if (js_get_value_string_utf8(env, prop, NULL, 0, &length) == 0) {
        length += 1; /* NULL */
        char *level_str = malloc(length);
        if (js_get_value_string_utf8(env, prop, (utf8_t*)level_str, length, NULL) == 0) {
          if (strcmp(level_str, "eager") == 0) {
            *level = XDL_MERGE_EAGER;
          } else if (strcmp(level_str, "zealous") == 0) {
            *level = XDL_MERGE_ZEALOUS;
          } else if (strcmp(level_str, "zealous_alnum") == 0) {
            *level = XDL_MERGE_ZEALOUS_ALNUM;
          }
        }
        free(level_str);
      }
    }
  }
  
  // favor
  if (js_get_named_property(env, options, "favor", &prop) == 0) {
    js_value_type_t prop_type;
    if (js_typeof(env, prop, &prop_type) == 0 && prop_type == js_string) {
      size_t length;
      if (js_get_value_string_utf8(env, prop, NULL, 0, &length) == 0) {
        length += 1; /* NULL */
        char *favor_str = malloc(length);
        if (js_get_value_string_utf8(env, prop, (utf8_t*)favor_str, length, NULL) == 0) {
          if (strcmp(favor_str, "ours") == 0) {
            *favor = XDL_MERGE_FAVOR_OURS;
          } else if (strcmp(favor_str, "theirs") == 0) {
            *favor = XDL_MERGE_FAVOR_THEIRS;
          } else if (strcmp(favor_str, "union") == 0) {
            *favor = XDL_MERGE_FAVOR_UNION;
          }
        }
        free(favor_str);
      }
    }
  }
  
  // style
  if (js_get_named_property(env, options, "style", &prop) == 0) {
    js_value_type_t prop_type;
    if (js_typeof(env, prop, &prop_type) == 0 && prop_type == js_string) {
      size_t length;
      if (js_get_value_string_utf8(env, prop, NULL, 0, &length) == 0) {
        length += 1; /* NULL */
        char *style_str = malloc(length);
        if (js_get_value_string_utf8(env, prop, (utf8_t*)style_str, length, NULL) == 0) {
          if (strcmp(style_str, "diff3") == 0) {
            *style = XDL_MERGE_DIFF3;
          } else if (strcmp(style_str, "zealous_diff3") == 0) {
            *style = XDL_MERGE_ZEALOUS_DIFF3;
          }
        }
        free(style_str);
      }
    }
  }
  
  // markerSize
  if (js_get_named_property(env, options, "markerSize", &prop) == 0) {
    js_value_type_t prop_type;
    if (js_typeof(env, prop, &prop_type) == 0 && prop_type == js_number) {
      int32_t size;
      if (js_get_value_int32(env, prop, &size) == 0 && size > 0) {
        *marker_size = size;
      }
    }
  }
}

// Callback for xdiff diff output
static int
xdiff_out_line(void *priv, mmbuffer_t *mb, int nbuf) {
  bare_xdiff_output_t *output = (bare_xdiff_output_t *)priv;
  
  for (int i = 0; i < nbuf; i++) {
    size_t new_len = output->len + mb[i].size;
    
    // Grow buffer if needed
    if (new_len > output->capacity) {
      size_t new_capacity = output->capacity * 2;
      if (new_capacity < new_len) {
        new_capacity = new_len + 1024;
      }
      char *new_data = xdl_realloc(output->data, new_capacity);
      if (!new_data) {
        return -1;
      }
      output->data = new_data;
      output->capacity = new_capacity;
    }
    
    memcpy(output->data + output->len, mb[i].ptr, mb[i].size);
    output->len = new_len;
  }
  
  return 0;
}

// Work function for diff operation
static void
bare_xdiff_diff_work(uv_work_t *req) {
  bare_xdiff_request_t *request = (bare_xdiff_request_t *)req->data;
  
  // Set up mmfile structures for xdiff
  mmfile_t mf1, mf2;
  mf1.ptr = (char *)request->buf1;
  mf1.size = (long)request->len1;
  mf2.ptr = (char *)request->buf2;
  mf2.size = (long)request->len2;
  
  // Configure xdiff parameters
  xpparam_t xpp;
  memset(&xpp, 0, sizeof(xpp));
  xpp.flags = request->diff_flags;
  
  xdemitconf_t xecfg;
  memset(&xecfg, 0, sizeof(xecfg));
  xecfg.ctxlen = 3; // Context lines for unified diff
  
  // Set up output handler
  bare_xdiff_output_t output;
  memset(&output, 0, sizeof(output));
  output.data = xdl_malloc(1024);
  output.capacity = 1024;
  output.len = 0;
  
  if (!output.data) {
    request->error_code = -1;
    return;
  }
  
  xdemitcb_t ecb;
  memset(&ecb, 0, sizeof(ecb));
  ecb.out_line = xdiff_out_line;
  ecb.priv = &output;
  
  // Perform the diff
  int result = xdl_diff(&mf1, &mf2, &xpp, &xecfg, &ecb);
  
  if (result < 0) {
    xdl_free(output.data);
    request->error_code = result;
  } else {
    request->result = output.data;
    request->result_len = output.len;
    request->error_code = 0;
  }
}

// Work function for merge operation
static void
bare_xdiff_merge_work(uv_work_t *req) {
  bare_xdiff_request_t *request = (bare_xdiff_request_t *)req->data;
  
  // Set up mmfile structures for three-way merge
  mmfile_t ancestor, ours, theirs;
  ancestor.ptr = (char *)request->buf1;
  ancestor.size = (long)request->len1;
  ours.ptr = (char *)request->buf2;
  ours.size = (long)request->len2;
  theirs.ptr = (char *)request->buf3;
  theirs.size = (long)request->len3;
  
  // Configure merge parameters
  xmparam_t xmp;
  memset(&xmp, 0, sizeof(xmp));
  xmp.marker_size = request->merge_marker_size;
  xmp.level = request->merge_level;
  xmp.favor = request->merge_favor;
  xmp.style = request->merge_style;
  
  // Output buffer
  mmbuffer_t result;
  memset(&result, 0, sizeof(result));
  
  // Perform the merge
  int ret = xdl_merge(&ancestor, &ours, &theirs, &xmp, &result);
  
  if (ret < 0) {
    request->error_code = ret;
    request->conflict_count = 0;
  } else {
    // Copy result
    request->result = xdl_malloc(result.size);
    if (request->result) {
      memcpy(request->result, result.ptr, result.size);
      request->result_len = result.size;
      request->error_code = 0;  // Success
      request->conflict_count = ret;  // Number of conflicts (0 or more)
    } else {
      request->error_code = -1;
      request->conflict_count = 0;
    }
    xdl_free(result.ptr);
  }
}

// Patch functionality is not supported by xdiff - stub implementation
static void
bare_xdiff_patch_work(uv_work_t *req) {
  bare_xdiff_request_t *request = (bare_xdiff_request_t *)req->data;
  request->error_code = -1; // Not implemented
}

// After work callback for all operations
static void
bare_xdiff_after(uv_work_t *req, int status) {
  int err;
  bare_xdiff_request_t *request = (bare_xdiff_request_t *)req->data;
  js_env_t *env = request->env;
  
  js_handle_scope_t *scope;
  err = js_open_handle_scope(env, &scope);
  assert(err == 0);
  
  js_value_t *ctx;
  err = js_get_reference_value(env, request->ctx, &ctx);
  assert(err == 0);
  
  js_value_t *callback;
  err = js_get_reference_value(env, request->callback, &callback);
  assert(err == 0);
  
  js_value_t *argv[2];
  
  if (status != 0 || request->error_code < 0) {
    // Call callback(error, null)
    js_value_t *message;
    err = js_create_string_utf8(env, (const utf8_t *)"Operation failed", -1, &message);
    assert(err == 0);
    err = js_create_error(env, NULL, message, &argv[0]);
    assert(err == 0);
    
    err = js_get_null(env, &argv[1]);
    assert(err == 0);
  } else {
    // Call callback(null, result)
    err = js_get_null(env, &argv[0]);
    assert(err == 0);
    
    // Check if this is a merge operation (has buf3)
    if (request->buf3 != NULL) {
      // For merge operations, return an object {conflict: boolean, output: string}
      js_value_t *result_obj;
      err = js_create_object(env, &result_obj);
      assert(err == 0);
      
      // Add conflict property
      js_value_t *conflict_prop;
      bool has_conflict = request->conflict_count > 0;
      err = js_get_boolean(env, has_conflict, &conflict_prop);
      assert(err == 0);
      err = js_set_named_property(env, result_obj, "conflict", conflict_prop);
      assert(err == 0);
      
      // Add output property as buffer
      js_value_t *output_arraybuffer, *output_prop;
      void *output_data;
      err = js_create_arraybuffer(env, request->result_len, &output_data, &output_arraybuffer);
      assert(err == 0);
      memcpy(output_data, request->result, request->result_len);
      
      err = js_create_typedarray(env, js_uint8array, request->result_len, output_arraybuffer, 0, &output_prop);
      assert(err == 0);
      err = js_set_named_property(env, result_obj, "output", output_prop);
      assert(err == 0);
      
      argv[1] = result_obj;
    } else {
      // For diff operations, return buffer
      js_value_t *result_arraybuffer;
      void *result_data;
      err = js_create_arraybuffer(env, request->result_len, &result_data, &result_arraybuffer);
      assert(err == 0);
      memcpy(result_data, request->result, request->result_len);
      
      err = js_create_typedarray(env, js_uint8array, request->result_len, result_arraybuffer, 0, &argv[1]);
      assert(err == 0);
    }
  }
  
  // Call the callback
  js_call_function(env, ctx, callback, 2, argv, NULL);
  
  err = js_close_handle_scope(env, scope);
  assert(err == 0);
  
  // Clean up
  xdl_free(request->buf1);
  xdl_free(request->buf2);
  if (request->buf3) xdl_free(request->buf3);
  if (request->result) xdl_free(request->result);
  
  err = js_delete_reference(env, request->ctx);
  assert(err == 0);
  
  err = js_delete_reference(env, request->callback);
  assert(err == 0);
  
  err = js_finish_deferred_teardown_callback(request->teardown);
  assert(err == 0);
  
  free(request);
}

// JavaScript function: diff
static js_value_t *
bare_xdiff_diff(js_env_t *env, js_callback_info_t *info) {
  int err;
  size_t argc = 4;
  js_value_t *argv[4];
  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);
  
  // Get buffer data for both inputs
  void *data1, *data2;
  size_t len1, len2;
  js_typedarray_type_t type1, type2;
  js_value_t *arraybuffer1, *arraybuffer2;
  size_t offset1, offset2;
  
  err = js_get_typedarray_info(env, argv[0], &type1, &data1, &len1, &arraybuffer1, &offset1);
  assert(err == 0);
  assert(type1 == js_uint8array);
  
  err = js_get_typedarray_info(env, argv[1], &type2, &data2, &len2, &arraybuffer2, &offset2);
  assert(err == 0);
  assert(type2 == js_uint8array);
  
  // Handle optional arguments: diff(a, b, callback) or diff(a, b, options, callback)
  js_value_t *options = NULL;
  js_value_t *callback;
  
  if (argc == 3) {
    // diff(a, b, callback)
    callback = argv[2];
  } else if (argc == 4) {
    // diff(a, b, options, callback)
    options = argv[2];
    callback = argv[3];
  } else {
    return NULL;
  }
  
  // Create request
  bare_xdiff_request_t *request = calloc(1, sizeof(bare_xdiff_request_t));
  request->env = env;
  
  // Parse options (if provided)
  if (options) {
    request->diff_flags = parse_diff_options(env, options);
  } else {
    request->diff_flags = 0;
  }
  
  // Copy input data
  request->buf1 = xdl_malloc(len1);
  request->len1 = len1;
  memcpy(request->buf1, (char*)data1 + offset1, len1);
  
  request->buf2 = xdl_malloc(len2);
  request->len2 = len2;
  memcpy(request->buf2, (char*)data2 + offset2, len2);
  
  // Store callback reference
  err = js_create_reference(env, callback, 1, &request->callback);
  assert(err == 0);
  
  // Get context
  js_value_t *ctx;
  err = js_get_callback_info(env, info, NULL, NULL, &ctx, NULL);
  assert(err == 0);
  
  err = js_create_reference(env, ctx, 1, &request->ctx);
  assert(err == 0);
  
  // Start teardown tracking
  err = js_add_deferred_teardown_callback(env, NULL, NULL, &request->teardown);
  assert(err == 0);
  
  // Queue work
  request->request.data = request;
  uv_loop_t *loop;
  err = js_get_env_loop(env, &loop);
  assert(err == 0);
  uv_queue_work(loop, &request->request, bare_xdiff_diff_work, bare_xdiff_after);
  
  return NULL;
}


// JavaScript function: merge
static js_value_t *
bare_xdiff_merge(js_env_t *env, js_callback_info_t *info) {
  int err;
  size_t argc = 5;
  js_value_t *argv[5];
  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);
  
  // Get buffer data for all three inputs
  void *data1, *data2, *data3;
  size_t len1, len2, len3;
  js_typedarray_type_t type1, type2, type3;
  js_value_t *arraybuffer1, *arraybuffer2, *arraybuffer3;
  size_t offset1, offset2, offset3;
  
  err = js_get_typedarray_info(env, argv[0], &type1, &data1, &len1, &arraybuffer1, &offset1);
  assert(err == 0);
  assert(type1 == js_uint8array);
  
  err = js_get_typedarray_info(env, argv[1], &type2, &data2, &len2, &arraybuffer2, &offset2);
  assert(err == 0);
  assert(type2 == js_uint8array);
  
  err = js_get_typedarray_info(env, argv[2], &type3, &data3, &len3, &arraybuffer3, &offset3);
  assert(err == 0);
  assert(type3 == js_uint8array);
  
  // Handle optional arguments: merge(o, a, b, callback) or merge(o, a, b, options, callback)
  js_value_t *options = NULL;
  js_value_t *callback;
  
  if (argc == 4) {
    // merge(o, a, b, callback)
    callback = argv[3];
  } else if (argc == 5) {
    // merge(o, a, b, options, callback)
    options = argv[3];
    callback = argv[4];
  } else {
    // Invalid number of arguments
    return NULL;
  }
  
  // Create request
  bare_xdiff_request_t *request = calloc(1, sizeof(bare_xdiff_request_t));
  request->env = env;
  
  // Parse merge options (if provided)
  if (options) {
    parse_merge_options(env, options, &request->merge_level, &request->merge_favor, &request->merge_style, &request->merge_marker_size);
  } else {
    request->merge_level = XDL_MERGE_MINIMAL;
    request->merge_favor = 0;
    request->merge_style = 0;
    request->merge_marker_size = 7;
  }
  
  // Copy input data
  request->buf1 = xdl_malloc(len1);
  request->len1 = len1;
  memcpy(request->buf1, (char*)data1 + offset1, len1);
  
  request->buf2 = xdl_malloc(len2);
  request->len2 = len2;
  memcpy(request->buf2, (char*)data2 + offset2, len2);
  
  request->buf3 = xdl_malloc(len3);
  request->len3 = len3;
  memcpy(request->buf3, (char*)data3 + offset3, len3);
  
  // Store callback reference
  err = js_create_reference(env, callback, 1, &request->callback);
  assert(err == 0);
  
  // Get context
  js_value_t *ctx;
  err = js_get_callback_info(env, info, NULL, NULL, &ctx, NULL);
  assert(err == 0);
  
  err = js_create_reference(env, ctx, 1, &request->ctx);
  assert(err == 0);
  
  // Start teardown tracking
  err = js_add_deferred_teardown_callback(env, NULL, NULL, &request->teardown);
  assert(err == 0);
  
  // Queue work
  request->request.data = request;
  uv_loop_t *loop;
  err = js_get_env_loop(env, &loop);
  assert(err == 0);
  uv_queue_work(loop, &request->request, bare_xdiff_merge_work, bare_xdiff_after);
  
  return NULL;
}

// Synchronous diff function
static js_value_t *
bare_xdiff_diff_sync(js_env_t *env, js_callback_info_t *info) {
  int err;
  size_t argc = 3;
  js_value_t *argv[3];
  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);
  
  // Get buffer data for both inputs
  void *data1, *data2;
  size_t len1, len2;
  js_typedarray_type_t type1, type2;
  js_value_t *arraybuffer1, *arraybuffer2;
  size_t offset1, offset2;
  
  err = js_get_typedarray_info(env, argv[0], &type1, &data1, &len1, &arraybuffer1, &offset1);
  assert(err == 0);
  assert(type1 == js_uint8array);
  
  err = js_get_typedarray_info(env, argv[1], &type2, &data2, &len2, &arraybuffer2, &offset2);
  assert(err == 0);
  assert(type2 == js_uint8array);
  
  // Third argument is options (optional)
  js_value_t *options = NULL;
  if (argc == 3) {
    options = argv[2];
  }
  
  // Parse options
  uint32_t diff_flags = 0;
  if (options) {
    diff_flags = parse_diff_options(env, options);
  }
  
  // Set up mmfile structures for xdiff
  mmfile_t mf1, mf2;
  mf1.ptr = (char*)data1 + offset1;
  mf1.size = (long)len1;
  mf2.ptr = (char*)data2 + offset2;
  mf2.size = (long)len2;
  
  // Configure xdiff parameters
  xpparam_t xpp;
  memset(&xpp, 0, sizeof(xpp));
  xpp.flags = diff_flags;
  
  xdemitconf_t xecfg;
  memset(&xecfg, 0, sizeof(xecfg));
  xecfg.ctxlen = 3; // Context lines for unified diff
  
  // Set up output handler
  bare_xdiff_output_t output;
  memset(&output, 0, sizeof(output));
  output.data = xdl_malloc(1024);
  output.capacity = 1024;
  output.len = 0;
  
  if (!output.data) {
    js_throw_error(env, NULL, "Memory allocation failed");
    return NULL;
  }
  
  // Set up callback
  xdemitcb_t ecb;
  memset(&ecb, 0, sizeof(ecb));
  ecb.out_line = xdiff_out_line;
  ecb.priv = &output;
  
  // Perform the diff
  int result = xdl_diff(&mf1, &mf2, &xpp, &xecfg, &ecb);
  
  if (result < 0) {
    xdl_free(output.data);
    js_throw_error(env, NULL, "xdl_diff failed");
    return NULL;
  }
  
  // Create result buffer
  js_value_t *result_buffer;
  void *result_data;
  err = js_create_arraybuffer(env, output.len, &result_data, &result_buffer);
  if (err != 0) {
    xdl_free(output.data);
    js_throw_error(env, NULL, "Failed to create result buffer");
    return NULL;
  }
  memcpy(result_data, output.data, output.len);
  
  js_value_t *result_uint8;
  err = js_create_typedarray(env, js_uint8array, output.len, result_buffer, 0, &result_uint8);
  if (err != 0) {
    xdl_free(output.data);
    js_throw_error(env, NULL, "Failed to create result Uint8Array");
    return NULL;
  }
  
  xdl_free(output.data);
  return result_uint8;
}

// Synchronous merge function
static js_value_t *
bare_xdiff_merge_sync(js_env_t *env, js_callback_info_t *info) {
  int err;
  size_t argc = 4;
  js_value_t *argv[4];
  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);
  
  // Get buffer data for all three inputs
  void *data1, *data2, *data3;
  size_t len1, len2, len3;
  js_typedarray_type_t type1, type2, type3;
  js_value_t *arraybuffer1, *arraybuffer2, *arraybuffer3;
  size_t offset1, offset2, offset3;
  
  err = js_get_typedarray_info(env, argv[0], &type1, &data1, &len1, &arraybuffer1, &offset1);
  assert(err == 0);
  assert(type1 == js_uint8array);
  
  err = js_get_typedarray_info(env, argv[1], &type2, &data2, &len2, &arraybuffer2, &offset2);
  assert(err == 0);
  assert(type2 == js_uint8array);
  
  err = js_get_typedarray_info(env, argv[2], &type3, &data3, &len3, &arraybuffer3, &offset3);
  assert(err == 0);
  assert(type3 == js_uint8array);
  
  // Fourth argument is options (optional)
  js_value_t *options = NULL;
  if (argc == 4) {
    options = argv[3];
  }
  
  // Parse merge options
  int32_t merge_level = XDL_MERGE_MINIMAL;
  int32_t merge_favor = 0;
  int32_t merge_style = 0;
  int32_t merge_marker_size = 7;
  
  if (options) {
    parse_merge_options(env, options, &merge_level, &merge_favor, &merge_style, &merge_marker_size);
  }
  
  // Set up mmfile structures for three-way merge
  mmfile_t ancestor, ours, theirs;
  ancestor.ptr = (char*)data1 + offset1;
  ancestor.size = (long)len1;
  ours.ptr = (char*)data2 + offset2;
  ours.size = (long)len2;
  theirs.ptr = (char*)data3 + offset3;
  theirs.size = (long)len3;
  
  // Configure merge parameters
  xmparam_t xmp;
  memset(&xmp, 0, sizeof(xmp));
  xmp.marker_size = merge_marker_size;
  xmp.level = merge_level;
  xmp.favor = merge_favor;
  xmp.style = merge_style;
  
  // Output buffer
  mmbuffer_t result;
  memset(&result, 0, sizeof(result));
  
  // Perform the merge
  int ret = xdl_merge(&ancestor, &ours, &theirs, &xmp, &result);
  
  if (ret < 0) {
    js_throw_error(env, NULL, "xdl_merge failed");
    return NULL;
  }
  
  // Create result object {conflict: boolean, output: string}
  js_value_t *result_obj;
  err = js_create_object(env, &result_obj);
  if (err != 0) {
    if (result.ptr) xdl_free(result.ptr);
    js_throw_error(env, NULL, "Failed to create result object");
    return NULL;
  }
  
  // Add conflict property
  js_value_t *conflict_prop;
  bool has_conflict = ret > 0;  // ret is the number of conflicts
  err = js_get_boolean(env, has_conflict, &conflict_prop);
  if (err != 0) {
    if (result.ptr) xdl_free(result.ptr);
    js_throw_error(env, NULL, "Failed to create conflict property");
    return NULL;
  }
  err = js_set_named_property(env, result_obj, "conflict", conflict_prop);
  if (err != 0) {
    if (result.ptr) xdl_free(result.ptr);
    js_throw_error(env, NULL, "Failed to set conflict property");
    return NULL;
  }
  
  // Add output property as buffer
  js_value_t *output_arraybuffer, *output_prop;
  void *output_data;
  err = js_create_arraybuffer(env, result.size, &output_data, &output_arraybuffer);
  if (err != 0) {
    if (result.ptr) xdl_free(result.ptr);
    js_throw_error(env, NULL, "Failed to create output buffer");
    return NULL;
  }
  memcpy(output_data, result.ptr, result.size);
  
  err = js_create_typedarray(env, js_uint8array, result.size, output_arraybuffer, 0, &output_prop);
  if (err != 0) {
    if (result.ptr) xdl_free(result.ptr);
    js_throw_error(env, NULL, "Failed to create output Uint8Array");
    return NULL;
  }
  err = js_set_named_property(env, result_obj, "output", output_prop);
  if (err != 0) {
    if (result.ptr) xdl_free(result.ptr);
    js_throw_error(env, NULL, "Failed to set output property");
    return NULL;
  }
  
  if (result.ptr) xdl_free(result.ptr);
  return result_obj;
}


// Module initialization
static js_value_t *
init(js_env_t *env, js_value_t *exports) {
  int err;
  
  // Export diff function
  js_value_t *diff_fn;
  err = js_create_function(env, "diff", -1, bare_xdiff_diff, NULL, &diff_fn);
  assert(err == 0);
  err = js_set_named_property(env, exports, "diff", diff_fn);
  assert(err == 0);
  
  
  // Export merge function
  js_value_t *merge_fn;
  err = js_create_function(env, "merge", -1, bare_xdiff_merge, NULL, &merge_fn);
  assert(err == 0);
  err = js_set_named_property(env, exports, "merge", merge_fn);
  assert(err == 0);
  
  // Export diffSync function
  js_value_t *diff_sync_fn;
  err = js_create_function(env, "diffSync", -1, bare_xdiff_diff_sync, NULL, &diff_sync_fn);
  assert(err == 0);
  err = js_set_named_property(env, exports, "diffSync", diff_sync_fn);
  assert(err == 0);
  
  // Export mergeSync function
  js_value_t *merge_sync_fn;
  err = js_create_function(env, "mergeSync", -1, bare_xdiff_merge_sync, NULL, &merge_sync_fn);
  assert(err == 0);
  err = js_set_named_property(env, exports, "mergeSync", merge_sync_fn);
  assert(err == 0);
  
  return exports;
}

BARE_MODULE(bare_xdiff, init)