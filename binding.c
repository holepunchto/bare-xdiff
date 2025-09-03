#include <assert.h>
#include <bare.h>
#include <js.h>
#include <stdlib.h>
#include <string.h>
#include <uv.h>

// Include xdiff headers
#include "xdiff.h"

// Request structure for async operations
typedef struct {
  uv_work_t request;
  js_env_t *env;
  js_ref_t *ctx;
  js_ref_t *callback;
  
  // Input buffers
  void *buf1;
  long len1;
  void *buf2;
  long len2;
  void *buf3;  // For merge operations
  long len3;
  
  // Output
  char *result;
  long result_len;
  int error_code;
  
  js_deferred_teardown_t *teardown;
} bare_xdiff_request_t;

// Output buffer for capturing xdiff output
typedef struct {
  char *data;
  long len;
  long capacity;
} xdiff_output_t;

// Callback for xdiff diff output
static int xdiff_out_line(void *priv, mmbuffer_t *mb, int nbuf) {
  xdiff_output_t *output = (xdiff_output_t *)priv;
  
  for (int i = 0; i < nbuf; i++) {
    long new_len = output->len + mb[i].size;
    
    // Grow buffer if needed
    if (new_len > output->capacity) {
      long new_capacity = output->capacity * 2;
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
static void bare_xdiff_diff_work(uv_work_t *req) {
  bare_xdiff_request_t *request = (bare_xdiff_request_t *)req->data;
  
  // Set up mmfile structures for xdiff
  mmfile_t mf1, mf2;
  mf1.ptr = (char *)request->buf1;
  mf1.size = request->len1;
  mf2.ptr = (char *)request->buf2;
  mf2.size = request->len2;
  
  // Configure xdiff parameters
  xpparam_t xpp;
  memset(&xpp, 0, sizeof(xpp));
  
  xdemitconf_t xecfg;
  memset(&xecfg, 0, sizeof(xecfg));
  xecfg.ctxlen = 3; // Context lines for unified diff
  
  // Set up output handler
  xdiff_output_t output;
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
static void bare_xdiff_merge_work(uv_work_t *req) {
  bare_xdiff_request_t *request = (bare_xdiff_request_t *)req->data;
  
  // Set up mmfile structures for three-way merge
  mmfile_t ancestor, ours, theirs;
  ancestor.ptr = (char *)request->buf1;
  ancestor.size = request->len1;
  ours.ptr = (char *)request->buf2;
  ours.size = request->len2;
  theirs.ptr = (char *)request->buf3;
  theirs.size = request->len3;
  
  // Configure merge parameters
  xmparam_t xmp;
  memset(&xmp, 0, sizeof(xmp));
  xmp.marker_size = DEFAULT_CONFLICT_MARKER_SIZE;
  xmp.level = XDL_MERGE_MINIMAL;
  xmp.favor = 0;
  xmp.style = 0;
  
  // Output buffer
  mmbuffer_t result;
  memset(&result, 0, sizeof(result));
  
  // Perform the merge
  int ret = xdl_merge(&ancestor, &ours, &theirs, &xmp, &result);
  
  if (ret < 0) {
    request->error_code = ret;
  } else {
    // Copy result
    request->result = xdl_malloc(result.size);
    if (request->result) {
      memcpy(request->result, result.ptr, result.size);
      request->result_len = result.size;
      request->error_code = ret; // Number of conflicts
    } else {
      request->error_code = -1;
    }
    xdl_free(result.ptr);
  }
}

// Work function for patch operation (simplified - xdiff doesn't have direct patch support)
static void bare_xdiff_patch_work(uv_work_t *req) {
  bare_xdiff_request_t *request = (bare_xdiff_request_t *)req->data;
  
  // For now, implement a basic patch operation
  // In a real implementation, you'd parse the unified diff format
  // and apply the changes. For this demo, we'll just return the original
  // if the patch is empty, or simulate patch application.
  
  if (request->len2 == 0) {
    // Empty patch - return original
    request->result = xdl_malloc(request->len1);
    if (request->result) {
      memcpy(request->result, request->buf1, request->len1);
      request->result_len = request->len1;
      request->error_code = 0;
    } else {
      request->error_code = -1;
    }
  } else {
    // For demo purposes, just return original
    // A real implementation would parse and apply the patch
    request->result = xdl_malloc(request->len1);
    if (request->result) {
      memcpy(request->result, request->buf1, request->len1);
      request->result_len = request->len1;
      request->error_code = 0;
    } else {
      request->error_code = -1;
    }
  }
}

// After work callback for all operations
static void bare_xdiff_after(uv_work_t *req, int status) {
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
    
    void *data;
    err = js_create_arraybuffer(env, request->result_len, &data, &argv[1]);
    assert(err == 0);
    
    if (request->result_len > 0) {
      memcpy(data, request->result, request->result_len);
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
  size_t argc = 3;
  js_value_t *argv[3];
  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);
  
  // Get string data for both inputs
  void *data1, *data2;
  size_t len1, len2;
  
  err = js_get_typedarray_info(env, argv[0], NULL, &data1, &len1, NULL, NULL);
  assert(err == 0);
  
  err = js_get_typedarray_info(env, argv[1], NULL, &data2, &len2, NULL, NULL);
  assert(err == 0);
  
  // Third argument is callback
  js_value_t *callback = argv[2];
  
  // Create request
  bare_xdiff_request_t *request = calloc(1, sizeof(bare_xdiff_request_t));
  request->env = env;
  
  // Copy input data
  request->buf1 = xdl_malloc(len1);
  request->len1 = len1;
  memcpy(request->buf1, data1, len1);
  
  request->buf2 = xdl_malloc(len2);
  request->len2 = len2;
  memcpy(request->buf2, data2, len2);
  
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

// JavaScript function: patch
static js_value_t *
bare_xdiff_patch(js_env_t *env, js_callback_info_t *info) {
  int err;
  size_t argc = 3;
  js_value_t *argv[3];
  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);
  
  // Get arraybuffer info for both inputs
  void *data1, *data2;
  size_t len1, len2;
  
  err = js_get_arraybuffer_info(env, argv[0], &data1, &len1);
  assert(err == 0);
  
  err = js_get_arraybuffer_info(env, argv[1], &data2, &len2);
  assert(err == 0);
  
  // Third argument is callback
  js_value_t *callback = argv[2];
  
  // Create request
  bare_xdiff_request_t *request = calloc(1, sizeof(bare_xdiff_request_t));
  request->env = env;
  
  // Copy input data
  request->buf1 = xdl_malloc(len1);
  request->len1 = len1;
  memcpy(request->buf1, data1, len1);
  
  request->buf2 = xdl_malloc(len2);
  request->len2 = len2;
  memcpy(request->buf2, data2, len2);
  
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
  uv_queue_work(loop, &request->request, bare_xdiff_patch_work, bare_xdiff_after);
  
  return NULL;
}

// JavaScript function: merge
static js_value_t *
bare_xdiff_merge(js_env_t *env, js_callback_info_t *info) {
  int err;
  size_t argc = 4;
  js_value_t *argv[4];
  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);
  
  // Get arraybuffer info for all three inputs
  void *data1, *data2, *data3;
  size_t len1, len2, len3;
  
  err = js_get_arraybuffer_info(env, argv[0], &data1, &len1);
  assert(err == 0);
  
  err = js_get_arraybuffer_info(env, argv[1], &data2, &len2);
  assert(err == 0);
  
  err = js_get_arraybuffer_info(env, argv[2], &data3, &len3);
  assert(err == 0);
  
  // Fourth argument is callback
  js_value_t *callback = argv[3];
  
  // Create request
  bare_xdiff_request_t *request = calloc(1, sizeof(bare_xdiff_request_t));
  request->env = env;
  
  // Copy input data
  request->buf1 = xdl_malloc(len1);
  request->len1 = len1;
  memcpy(request->buf1, data1, len1);
  
  request->buf2 = xdl_malloc(len2);
  request->len2 = len2;
  memcpy(request->buf2, data2, len2);
  
  request->buf3 = xdl_malloc(len3);
  request->len3 = len3;
  memcpy(request->buf3, data3, len3);
  
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

// Simple test work function
static void bare_xdiff_test_work(uv_work_t *req) {
  bare_xdiff_request_t *request = (bare_xdiff_request_t *)req->data;
  
  // Just create a simple test result
  const char *test_output = "test result";
  size_t output_len = strlen(test_output);
  
  request->result = xdl_malloc(output_len);
  if (request->result) {
    memcpy(request->result, test_output, output_len);
    request->result_len = output_len;
    request->error_code = 0;
  } else {
    request->error_code = -1;
  }
}

// JavaScript test function
static js_value_t *
bare_xdiff_test(js_env_t *env, js_callback_info_t *info) {
  int err;
  size_t argc = 1;
  js_value_t *argv[1];
  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);
  
  // Only argument is callback
  js_value_t *callback = argv[0];
  
  // Create request
  bare_xdiff_request_t *request = calloc(1, sizeof(bare_xdiff_request_t));
  request->env = env;
  
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
  uv_queue_work(loop, &request->request, bare_xdiff_test_work, bare_xdiff_after);
  
  return NULL;
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
  
  // Export patch function
  js_value_t *patch_fn;
  err = js_create_function(env, "patch", -1, bare_xdiff_patch, NULL, &patch_fn);
  assert(err == 0);
  err = js_set_named_property(env, exports, "patch", patch_fn);
  assert(err == 0);
  
  // Export merge function
  js_value_t *merge_fn;
  err = js_create_function(env, "merge", -1, bare_xdiff_merge, NULL, &merge_fn);
  assert(err == 0);
  err = js_set_named_property(env, exports, "merge", merge_fn);
  assert(err == 0);
  
  // Export test function
  js_value_t *test_fn;
  err = js_create_function(env, "test", -1, bare_xdiff_test, NULL, &test_fn);
  assert(err == 0);
  err = js_set_named_property(env, exports, "test", test_fn);
  assert(err == 0);
  
  return exports;
}

BARE_MODULE(bare_xdiff, init)