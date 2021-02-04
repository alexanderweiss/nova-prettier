'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

class ProcessError extends Error {
	constructor(status, message) {
		super(message);
		this.status = status;
	}
}

function showError(id, title, body) {
	let request = new NotificationRequest(id);

	request.title = nova.localize(title);
	request.body = nova.localize(body);
	request.actions = [nova.localize('OK')];

	nova.notifications.add(request).catch((err) => console.error(err, err.stack));
}

function showActionableError(id, title, body, actions, callback) {
	let request = new NotificationRequest(id);

	request.title = nova.localize(title);
	request.body = nova.localize(body);
	request.actions = actions.map((action) => nova.localize(action));

	nova.notifications
		.add(request)
		.then((response) => callback(response.actionIdx))
		.catch((err) => console.error(err, err.stack));
}

function getConfigWithWorkspaceOverride(name) {
	const workspaceConfig = getWorkspaceConfig(name);
	const extensionConfig = nova.config.get(name);

	return workspaceConfig === null ? extensionConfig : workspaceConfig
}

function getWorkspaceConfig(name) {
	const value = nova.workspace.config.get(name);
	switch (value) {
		case 'Enable':
			return true
		case 'Disable':
			return false
		case 'Global Default':
			return null
		default:
			return value
	}
}

function handleProcessResult(process, reject, resolve) {
	const errors = [];
	process.onStderr((err) => {
		errors.push(err);
	});

	process.onDidExit((status) => {
		if (status === 0) {
			if (resolve) resolve();
			return
		}

		reject(new ProcessError(status, errors.join('\n')));
	});
}

const log = Object.fromEntries(
	['log', 'info', 'warn'].map((fn) => [
		fn,
		(...args) => {
			if (!nova.inDevMode() && !nova.config.get('prettier.debug.logging')) {
				return
			}
			console[fn](...args);
		},
	])
);

var helpers = {
	showError,
	showActionableError,
	log,
	getConfigWithWorkspaceOverride,
	ProcessError,
	handleProcessResult,
};

const { handleProcessResult: handleProcessResult$1, log: log$1 } = helpers;

async function findPrettier(directory) {
	let resolve, reject;
	const promise = new Promise((_resolve, _reject) => {
		resolve = _resolve;
		reject = _reject;
	});

	const process = new Process('/usr/bin/env', {
		args: ['npm', 'ls', 'prettier', '--parseable', '--long', '--depth', '0'],
		cwd: directory,
	});

	process.onStdout((result) => {
		if (!result || !result.trim()) return

		const [path, name, status, extra] = result.trim().split(':');
		if (!name || !name.startsWith('prettier@')) return resolve(null)
		if (path === nova.workspace.path) {
			log$1.info(
				`You seem to be working on Prettier! The extension doesn't work without Prettier built, so using the built-in Prettier instead.`
			);
			return resolve(null)
		}

		resolve({
			path,
			correctVersion: status !== 'INVALID' && extra !== 'MAXDEPTH',
		});
	});

	handleProcessResult$1(process, reject, resolve);
	process.start();

	return promise
}

async function installPrettier(directory) {
	let resolve, reject;
	const promise = new Promise((_resolve, _reject) => {
		resolve = _resolve;
		reject = _reject;
	});

	const process = new Process('/usr/bin/env', {
		args: ['npm', 'install', '--only-prod'],
		cwd: directory,
	});

	handleProcessResult$1(process, reject, resolve);
	process.start();

	return promise
}

var prettierInstallation = async function () {
	// Try finding in the workspace
	try {
		if (nova.workspace.path) {
			const resolved = await findPrettier(nova.workspace.path);
			if (resolved) {
				log$1.info(`Loading project prettier at ${resolved.path}`);
				return resolved.path
			}
		}
	} catch (err) {
		if (err.status === 127) throw err
		log$1.warn('Error trying to find workspace Prettier', err);
	}

	// Install / update bundled version
	try {
		const path = nova.path.join(nova.extension.path, 'node_modules', 'prettier');

		const resolved = await findPrettier(nova.extension.path);

		if (!resolved || !resolved.correctVersion) {
			log$1.info(`Installing / updating bundled Prettier at ${path}`);
			await installPrettier(nova.extension.path);
		}

		log$1.info(`Loading bundled prettier at ${path}`);
		return path
	} catch (err) {
		if (err.status === 127) throw err
		log$1.warn('Error trying to find or install bundled Prettier', err);
	}
};

/**
 * This library modifies the diff-patch-match library by Neil Fraser
 * by removing the patch and match functionality and certain advanced
 * options in the diff function. The original license is as follows:
 *
 * ===
 *
 * Diff Match and Patch
 *
 * Copyright 2006 Google Inc.
 * http://code.google.com/p/google-diff-match-patch/
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */


/**
 * The data structure representing a diff is an array of tuples:
 * [[DIFF_DELETE, 'Hello'], [DIFF_INSERT, 'Goodbye'], [DIFF_EQUAL, ' world.']]
 * which means: delete 'Hello', add 'Goodbye' and keep ' world.'
 */
var DIFF_DELETE = -1;
var DIFF_INSERT = 1;
var DIFF_EQUAL = 0;


/**
 * Find the differences between two texts.  Simplifies the problem by stripping
 * any common prefix or suffix off the texts before diffing.
 * @param {string} text1 Old string to be diffed.
 * @param {string} text2 New string to be diffed.
 * @param {Int|Object} [cursor_pos] Edit position in text1 or object with more info
 * @return {Array} Array of diff tuples.
 */
function diff_main(text1, text2, cursor_pos, _fix_unicode) {
  // Check for equality
  if (text1 === text2) {
    if (text1) {
      return [[DIFF_EQUAL, text1]];
    }
    return [];
  }

  if (cursor_pos != null) {
    var editdiff = find_cursor_edit_diff(text1, text2, cursor_pos);
    if (editdiff) {
      return editdiff;
    }
  }

  // Trim off common prefix (speedup).
  var commonlength = diff_commonPrefix(text1, text2);
  var commonprefix = text1.substring(0, commonlength);
  text1 = text1.substring(commonlength);
  text2 = text2.substring(commonlength);

  // Trim off common suffix (speedup).
  commonlength = diff_commonSuffix(text1, text2);
  var commonsuffix = text1.substring(text1.length - commonlength);
  text1 = text1.substring(0, text1.length - commonlength);
  text2 = text2.substring(0, text2.length - commonlength);

  // Compute the diff on the middle block.
  var diffs = diff_compute_(text1, text2);

  // Restore the prefix and suffix.
  if (commonprefix) {
    diffs.unshift([DIFF_EQUAL, commonprefix]);
  }
  if (commonsuffix) {
    diffs.push([DIFF_EQUAL, commonsuffix]);
  }
  diff_cleanupMerge(diffs, _fix_unicode);
  return diffs;
}

/**
 * Find the differences between two texts.  Assumes that the texts do not
 * have any common prefix or suffix.
 * @param {string} text1 Old string to be diffed.
 * @param {string} text2 New string to be diffed.
 * @return {Array} Array of diff tuples.
 */
function diff_compute_(text1, text2) {
  var diffs;

  if (!text1) {
    // Just add some text (speedup).
    return [[DIFF_INSERT, text2]];
  }

  if (!text2) {
    // Just delete some text (speedup).
    return [[DIFF_DELETE, text1]];
  }

  var longtext = text1.length > text2.length ? text1 : text2;
  var shorttext = text1.length > text2.length ? text2 : text1;
  var i = longtext.indexOf(shorttext);
  if (i !== -1) {
    // Shorter text is inside the longer text (speedup).
    diffs = [
      [DIFF_INSERT, longtext.substring(0, i)],
      [DIFF_EQUAL, shorttext],
      [DIFF_INSERT, longtext.substring(i + shorttext.length)]
    ];
    // Swap insertions for deletions if diff is reversed.
    if (text1.length > text2.length) {
      diffs[0][0] = diffs[2][0] = DIFF_DELETE;
    }
    return diffs;
  }

  if (shorttext.length === 1) {
    // Single character string.
    // After the previous speedup, the character can't be an equality.
    return [[DIFF_DELETE, text1], [DIFF_INSERT, text2]];
  }

  // Check to see if the problem can be split in two.
  var hm = diff_halfMatch_(text1, text2);
  if (hm) {
    // A half-match was found, sort out the return data.
    var text1_a = hm[0];
    var text1_b = hm[1];
    var text2_a = hm[2];
    var text2_b = hm[3];
    var mid_common = hm[4];
    // Send both pairs off for separate processing.
    var diffs_a = diff_main(text1_a, text2_a);
    var diffs_b = diff_main(text1_b, text2_b);
    // Merge the results.
    return diffs_a.concat([[DIFF_EQUAL, mid_common]], diffs_b);
  }

  return diff_bisect_(text1, text2);
}

/**
 * Find the 'middle snake' of a diff, split the problem in two
 * and return the recursively constructed diff.
 * See Myers 1986 paper: An O(ND) Difference Algorithm and Its Variations.
 * @param {string} text1 Old string to be diffed.
 * @param {string} text2 New string to be diffed.
 * @return {Array} Array of diff tuples.
 * @private
 */
function diff_bisect_(text1, text2) {
  // Cache the text lengths to prevent multiple calls.
  var text1_length = text1.length;
  var text2_length = text2.length;
  var max_d = Math.ceil((text1_length + text2_length) / 2);
  var v_offset = max_d;
  var v_length = 2 * max_d;
  var v1 = new Array(v_length);
  var v2 = new Array(v_length);
  // Setting all elements to -1 is faster in Chrome & Firefox than mixing
  // integers and undefined.
  for (var x = 0; x < v_length; x++) {
    v1[x] = -1;
    v2[x] = -1;
  }
  v1[v_offset + 1] = 0;
  v2[v_offset + 1] = 0;
  var delta = text1_length - text2_length;
  // If the total number of characters is odd, then the front path will collide
  // with the reverse path.
  var front = (delta % 2 !== 0);
  // Offsets for start and end of k loop.
  // Prevents mapping of space beyond the grid.
  var k1start = 0;
  var k1end = 0;
  var k2start = 0;
  var k2end = 0;
  for (var d = 0; d < max_d; d++) {
    // Walk the front path one step.
    for (var k1 = -d + k1start; k1 <= d - k1end; k1 += 2) {
      var k1_offset = v_offset + k1;
      var x1;
      if (k1 === -d || (k1 !== d && v1[k1_offset - 1] < v1[k1_offset + 1])) {
        x1 = v1[k1_offset + 1];
      } else {
        x1 = v1[k1_offset - 1] + 1;
      }
      var y1 = x1 - k1;
      while (
        x1 < text1_length && y1 < text2_length &&
        text1.charAt(x1) === text2.charAt(y1)
      ) {
        x1++;
        y1++;
      }
      v1[k1_offset] = x1;
      if (x1 > text1_length) {
        // Ran off the right of the graph.
        k1end += 2;
      } else if (y1 > text2_length) {
        // Ran off the bottom of the graph.
        k1start += 2;
      } else if (front) {
        var k2_offset = v_offset + delta - k1;
        if (k2_offset >= 0 && k2_offset < v_length && v2[k2_offset] !== -1) {
          // Mirror x2 onto top-left coordinate system.
          var x2 = text1_length - v2[k2_offset];
          if (x1 >= x2) {
            // Overlap detected.
            return diff_bisectSplit_(text1, text2, x1, y1);
          }
        }
      }
    }

    // Walk the reverse path one step.
    for (var k2 = -d + k2start; k2 <= d - k2end; k2 += 2) {
      var k2_offset = v_offset + k2;
      var x2;
      if (k2 === -d || (k2 !== d && v2[k2_offset - 1] < v2[k2_offset + 1])) {
        x2 = v2[k2_offset + 1];
      } else {
        x2 = v2[k2_offset - 1] + 1;
      }
      var y2 = x2 - k2;
      while (
        x2 < text1_length && y2 < text2_length &&
        text1.charAt(text1_length - x2 - 1) === text2.charAt(text2_length - y2 - 1)
      ) {
        x2++;
        y2++;
      }
      v2[k2_offset] = x2;
      if (x2 > text1_length) {
        // Ran off the left of the graph.
        k2end += 2;
      } else if (y2 > text2_length) {
        // Ran off the top of the graph.
        k2start += 2;
      } else if (!front) {
        var k1_offset = v_offset + delta - k2;
        if (k1_offset >= 0 && k1_offset < v_length && v1[k1_offset] !== -1) {
          var x1 = v1[k1_offset];
          var y1 = v_offset + x1 - k1_offset;
          // Mirror x2 onto top-left coordinate system.
          x2 = text1_length - x2;
          if (x1 >= x2) {
            // Overlap detected.
            return diff_bisectSplit_(text1, text2, x1, y1);
          }
        }
      }
    }
  }
  // Diff took too long and hit the deadline or
  // number of diffs equals number of characters, no commonality at all.
  return [[DIFF_DELETE, text1], [DIFF_INSERT, text2]];
}

/**
 * Given the location of the 'middle snake', split the diff in two parts
 * and recurse.
 * @param {string} text1 Old string to be diffed.
 * @param {string} text2 New string to be diffed.
 * @param {number} x Index of split point in text1.
 * @param {number} y Index of split point in text2.
 * @return {Array} Array of diff tuples.
 */
function diff_bisectSplit_(text1, text2, x, y) {
  var text1a = text1.substring(0, x);
  var text2a = text2.substring(0, y);
  var text1b = text1.substring(x);
  var text2b = text2.substring(y);

  // Compute both diffs serially.
  var diffs = diff_main(text1a, text2a);
  var diffsb = diff_main(text1b, text2b);

  return diffs.concat(diffsb);
}

/**
 * Determine the common prefix of two strings.
 * @param {string} text1 First string.
 * @param {string} text2 Second string.
 * @return {number} The number of characters common to the start of each
 *     string.
 */
function diff_commonPrefix(text1, text2) {
  // Quick check for common null cases.
  if (!text1 || !text2 || text1.charAt(0) !== text2.charAt(0)) {
    return 0;
  }
  // Binary search.
  // Performance analysis: http://neil.fraser.name/news/2007/10/09/
  var pointermin = 0;
  var pointermax = Math.min(text1.length, text2.length);
  var pointermid = pointermax;
  var pointerstart = 0;
  while (pointermin < pointermid) {
    if (
      text1.substring(pointerstart, pointermid) ==
      text2.substring(pointerstart, pointermid)
    ) {
      pointermin = pointermid;
      pointerstart = pointermin;
    } else {
      pointermax = pointermid;
    }
    pointermid = Math.floor((pointermax - pointermin) / 2 + pointermin);
  }

  if (is_surrogate_pair_start(text1.charCodeAt(pointermid - 1))) {
    pointermid--;
  }

  return pointermid;
}

/**
 * Determine the common suffix of two strings.
 * @param {string} text1 First string.
 * @param {string} text2 Second string.
 * @return {number} The number of characters common to the end of each string.
 */
function diff_commonSuffix(text1, text2) {
  // Quick check for common null cases.
  if (!text1 || !text2 || text1.slice(-1) !== text2.slice(-1)) {
    return 0;
  }
  // Binary search.
  // Performance analysis: http://neil.fraser.name/news/2007/10/09/
  var pointermin = 0;
  var pointermax = Math.min(text1.length, text2.length);
  var pointermid = pointermax;
  var pointerend = 0;
  while (pointermin < pointermid) {
    if (
      text1.substring(text1.length - pointermid, text1.length - pointerend) ==
      text2.substring(text2.length - pointermid, text2.length - pointerend)
    ) {
      pointermin = pointermid;
      pointerend = pointermin;
    } else {
      pointermax = pointermid;
    }
    pointermid = Math.floor((pointermax - pointermin) / 2 + pointermin);
  }

  if (is_surrogate_pair_end(text1.charCodeAt(text1.length - pointermid))) {
    pointermid--;
  }

  return pointermid;
}

/**
 * Do the two texts share a substring which is at least half the length of the
 * longer text?
 * This speedup can produce non-minimal diffs.
 * @param {string} text1 First string.
 * @param {string} text2 Second string.
 * @return {Array.<string>} Five element Array, containing the prefix of
 *     text1, the suffix of text1, the prefix of text2, the suffix of
 *     text2 and the common middle.  Or null if there was no match.
 */
function diff_halfMatch_(text1, text2) {
  var longtext = text1.length > text2.length ? text1 : text2;
  var shorttext = text1.length > text2.length ? text2 : text1;
  if (longtext.length < 4 || shorttext.length * 2 < longtext.length) {
    return null;  // Pointless.
  }

  /**
   * Does a substring of shorttext exist within longtext such that the substring
   * is at least half the length of longtext?
   * Closure, but does not reference any external variables.
   * @param {string} longtext Longer string.
   * @param {string} shorttext Shorter string.
   * @param {number} i Start index of quarter length substring within longtext.
   * @return {Array.<string>} Five element Array, containing the prefix of
   *     longtext, the suffix of longtext, the prefix of shorttext, the suffix
   *     of shorttext and the common middle.  Or null if there was no match.
   * @private
   */
  function diff_halfMatchI_(longtext, shorttext, i) {
    // Start with a 1/4 length substring at position i as a seed.
    var seed = longtext.substring(i, i + Math.floor(longtext.length / 4));
    var j = -1;
    var best_common = '';
    var best_longtext_a, best_longtext_b, best_shorttext_a, best_shorttext_b;
    while ((j = shorttext.indexOf(seed, j + 1)) !== -1) {
      var prefixLength = diff_commonPrefix(
        longtext.substring(i), shorttext.substring(j));
      var suffixLength = diff_commonSuffix(
        longtext.substring(0, i), shorttext.substring(0, j));
      if (best_common.length < suffixLength + prefixLength) {
        best_common = shorttext.substring(
          j - suffixLength, j) + shorttext.substring(j, j + prefixLength);
        best_longtext_a = longtext.substring(0, i - suffixLength);
        best_longtext_b = longtext.substring(i + prefixLength);
        best_shorttext_a = shorttext.substring(0, j - suffixLength);
        best_shorttext_b = shorttext.substring(j + prefixLength);
      }
    }
    if (best_common.length * 2 >= longtext.length) {
      return [
        best_longtext_a, best_longtext_b,
        best_shorttext_a, best_shorttext_b, best_common
      ];
    } else {
      return null;
    }
  }

  // First check if the second quarter is the seed for a half-match.
  var hm1 = diff_halfMatchI_(longtext, shorttext, Math.ceil(longtext.length / 4));
  // Check again based on the third quarter.
  var hm2 = diff_halfMatchI_(longtext, shorttext, Math.ceil(longtext.length / 2));
  var hm;
  if (!hm1 && !hm2) {
    return null;
  } else if (!hm2) {
    hm = hm1;
  } else if (!hm1) {
    hm = hm2;
  } else {
    // Both matched.  Select the longest.
    hm = hm1[4].length > hm2[4].length ? hm1 : hm2;
  }

  // A half-match was found, sort out the return data.
  var text1_a, text1_b, text2_a, text2_b;
  if (text1.length > text2.length) {
    text1_a = hm[0];
    text1_b = hm[1];
    text2_a = hm[2];
    text2_b = hm[3];
  } else {
    text2_a = hm[0];
    text2_b = hm[1];
    text1_a = hm[2];
    text1_b = hm[3];
  }
  var mid_common = hm[4];
  return [text1_a, text1_b, text2_a, text2_b, mid_common];
}

/**
 * Reorder and merge like edit sections.  Merge equalities.
 * Any edit section can move as long as it doesn't cross an equality.
 * @param {Array} diffs Array of diff tuples.
 * @param {boolean} fix_unicode Whether to normalize to a unicode-correct diff
 */
function diff_cleanupMerge(diffs, fix_unicode) {
  diffs.push([DIFF_EQUAL, '']);  // Add a dummy entry at the end.
  var pointer = 0;
  var count_delete = 0;
  var count_insert = 0;
  var text_delete = '';
  var text_insert = '';
  var commonlength;
  while (pointer < diffs.length) {
    if (pointer < diffs.length - 1 && !diffs[pointer][1]) {
      diffs.splice(pointer, 1);
      continue;
    }
    switch (diffs[pointer][0]) {
      case DIFF_INSERT:

        count_insert++;
        text_insert += diffs[pointer][1];
        pointer++;
        break;
      case DIFF_DELETE:
        count_delete++;
        text_delete += diffs[pointer][1];
        pointer++;
        break;
      case DIFF_EQUAL:
        var previous_equality = pointer - count_insert - count_delete - 1;
        if (fix_unicode) {
          // prevent splitting of unicode surrogate pairs.  when fix_unicode is true,
          // we assume that the old and new text in the diff are complete and correct
          // unicode-encoded JS strings, but the tuple boundaries may fall between
          // surrogate pairs.  we fix this by shaving off stray surrogates from the end
          // of the previous equality and the beginning of this equality.  this may create
          // empty equalities or a common prefix or suffix.  for example, if AB and AC are
          // emojis, `[[0, 'A'], [-1, 'BA'], [0, 'C']]` would turn into deleting 'ABAC' and
          // inserting 'AC', and then the common suffix 'AC' will be eliminated.  in this
          // particular case, both equalities go away, we absorb any previous inequalities,
          // and we keep scanning for the next equality before rewriting the tuples.
          if (previous_equality >= 0 && ends_with_pair_start(diffs[previous_equality][1])) {
            var stray = diffs[previous_equality][1].slice(-1);
            diffs[previous_equality][1] = diffs[previous_equality][1].slice(0, -1);
            text_delete = stray + text_delete;
            text_insert = stray + text_insert;
            if (!diffs[previous_equality][1]) {
              // emptied out previous equality, so delete it and include previous delete/insert
              diffs.splice(previous_equality, 1);
              pointer--;
              var k = previous_equality - 1;
              if (diffs[k] && diffs[k][0] === DIFF_INSERT) {
                count_insert++;
                text_insert = diffs[k][1] + text_insert;
                k--;
              }
              if (diffs[k] && diffs[k][0] === DIFF_DELETE) {
                count_delete++;
                text_delete = diffs[k][1] + text_delete;
                k--;
              }
              previous_equality = k;
            }
          }
          if (starts_with_pair_end(diffs[pointer][1])) {
            var stray = diffs[pointer][1].charAt(0);
            diffs[pointer][1] = diffs[pointer][1].slice(1);
            text_delete += stray;
            text_insert += stray;
          }
        }
        if (pointer < diffs.length - 1 && !diffs[pointer][1]) {
          // for empty equality not at end, wait for next equality
          diffs.splice(pointer, 1);
          break;
        }
        if (text_delete.length > 0 || text_insert.length > 0) {
          // note that diff_commonPrefix and diff_commonSuffix are unicode-aware
          if (text_delete.length > 0 && text_insert.length > 0) {
            // Factor out any common prefixes.
            commonlength = diff_commonPrefix(text_insert, text_delete);
            if (commonlength !== 0) {
              if (previous_equality >= 0) {
                diffs[previous_equality][1] += text_insert.substring(0, commonlength);
              } else {
                diffs.splice(0, 0, [DIFF_EQUAL, text_insert.substring(0, commonlength)]);
                pointer++;
              }
              text_insert = text_insert.substring(commonlength);
              text_delete = text_delete.substring(commonlength);
            }
            // Factor out any common suffixes.
            commonlength = diff_commonSuffix(text_insert, text_delete);
            if (commonlength !== 0) {
              diffs[pointer][1] =
                text_insert.substring(text_insert.length - commonlength) + diffs[pointer][1];
              text_insert = text_insert.substring(0, text_insert.length - commonlength);
              text_delete = text_delete.substring(0, text_delete.length - commonlength);
            }
          }
          // Delete the offending records and add the merged ones.
          var n = count_insert + count_delete;
          if (text_delete.length === 0 && text_insert.length === 0) {
            diffs.splice(pointer - n, n);
            pointer = pointer - n;
          } else if (text_delete.length === 0) {
            diffs.splice(pointer - n, n, [DIFF_INSERT, text_insert]);
            pointer = pointer - n + 1;
          } else if (text_insert.length === 0) {
            diffs.splice(pointer - n, n, [DIFF_DELETE, text_delete]);
            pointer = pointer - n + 1;
          } else {
            diffs.splice(pointer - n, n, [DIFF_DELETE, text_delete], [DIFF_INSERT, text_insert]);
            pointer = pointer - n + 2;
          }
        }
        if (pointer !== 0 && diffs[pointer - 1][0] === DIFF_EQUAL) {
          // Merge this equality with the previous one.
          diffs[pointer - 1][1] += diffs[pointer][1];
          diffs.splice(pointer, 1);
        } else {
          pointer++;
        }
        count_insert = 0;
        count_delete = 0;
        text_delete = '';
        text_insert = '';
        break;
    }
  }
  if (diffs[diffs.length - 1][1] === '') {
    diffs.pop();  // Remove the dummy entry at the end.
  }

  // Second pass: look for single edits surrounded on both sides by equalities
  // which can be shifted sideways to eliminate an equality.
  // e.g: A<ins>BA</ins>C -> <ins>AB</ins>AC
  var changes = false;
  pointer = 1;
  // Intentionally ignore the first and last element (don't need checking).
  while (pointer < diffs.length - 1) {
    if (diffs[pointer - 1][0] === DIFF_EQUAL &&
      diffs[pointer + 1][0] === DIFF_EQUAL) {
      // This is a single edit surrounded by equalities.
      if (diffs[pointer][1].substring(diffs[pointer][1].length -
        diffs[pointer - 1][1].length) === diffs[pointer - 1][1]) {
        // Shift the edit over the previous equality.
        diffs[pointer][1] = diffs[pointer - 1][1] +
          diffs[pointer][1].substring(0, diffs[pointer][1].length -
            diffs[pointer - 1][1].length);
        diffs[pointer + 1][1] = diffs[pointer - 1][1] + diffs[pointer + 1][1];
        diffs.splice(pointer - 1, 1);
        changes = true;
      } else if (diffs[pointer][1].substring(0, diffs[pointer + 1][1].length) ==
        diffs[pointer + 1][1]) {
        // Shift the edit over the next equality.
        diffs[pointer - 1][1] += diffs[pointer + 1][1];
        diffs[pointer][1] =
          diffs[pointer][1].substring(diffs[pointer + 1][1].length) +
          diffs[pointer + 1][1];
        diffs.splice(pointer + 1, 1);
        changes = true;
      }
    }
    pointer++;
  }
  // If shifts were made, the diff needs reordering and another shift sweep.
  if (changes) {
    diff_cleanupMerge(diffs, fix_unicode);
  }
}
function is_surrogate_pair_start(charCode) {
  return charCode >= 0xD800 && charCode <= 0xDBFF;
}

function is_surrogate_pair_end(charCode) {
  return charCode >= 0xDC00 && charCode <= 0xDFFF;
}

function starts_with_pair_end(str) {
  return is_surrogate_pair_end(str.charCodeAt(0));
}

function ends_with_pair_start(str) {
  return is_surrogate_pair_start(str.charCodeAt(str.length - 1));
}

function remove_empty_tuples(tuples) {
  var ret = [];
  for (var i = 0; i < tuples.length; i++) {
    if (tuples[i][1].length > 0) {
      ret.push(tuples[i]);
    }
  }
  return ret;
}

function make_edit_splice(before, oldMiddle, newMiddle, after) {
  if (ends_with_pair_start(before) || starts_with_pair_end(after)) {
    return null;
  }
  return remove_empty_tuples([
    [DIFF_EQUAL, before],
    [DIFF_DELETE, oldMiddle],
    [DIFF_INSERT, newMiddle],
    [DIFF_EQUAL, after]
  ]);
}

function find_cursor_edit_diff(oldText, newText, cursor_pos) {
  // note: this runs after equality check has ruled out exact equality
  var oldRange = typeof cursor_pos === 'number' ?
    { index: cursor_pos, length: 0 } : cursor_pos.oldRange;
  var newRange = typeof cursor_pos === 'number' ?
    null : cursor_pos.newRange;
  // take into account the old and new selection to generate the best diff
  // possible for a text edit.  for example, a text change from "xxx" to "xx"
  // could be a delete or forwards-delete of any one of the x's, or the
  // result of selecting two of the x's and typing "x".
  var oldLength = oldText.length;
  var newLength = newText.length;
  if (oldRange.length === 0 && (newRange === null || newRange.length === 0)) {
    // see if we have an insert or delete before or after cursor
    var oldCursor = oldRange.index;
    var oldBefore = oldText.slice(0, oldCursor);
    var oldAfter = oldText.slice(oldCursor);
    var maybeNewCursor = newRange ? newRange.index : null;
    editBefore: {
      // is this an insert or delete right before oldCursor?
      var newCursor = oldCursor + newLength - oldLength;
      if (maybeNewCursor !== null && maybeNewCursor !== newCursor) {
        break editBefore;
      }
      if (newCursor < 0 || newCursor > newLength) {
        break editBefore;
      }
      var newBefore = newText.slice(0, newCursor);
      var newAfter = newText.slice(newCursor);
      if (newAfter !== oldAfter) {
        break editBefore;
      }
      var prefixLength = Math.min(oldCursor, newCursor);
      var oldPrefix = oldBefore.slice(0, prefixLength);
      var newPrefix = newBefore.slice(0, prefixLength);
      if (oldPrefix !== newPrefix) {
        break editBefore;
      }
      var oldMiddle = oldBefore.slice(prefixLength);
      var newMiddle = newBefore.slice(prefixLength);
      return make_edit_splice(oldPrefix, oldMiddle, newMiddle, oldAfter);
    }
    editAfter: {
      // is this an insert or delete right after oldCursor?
      if (maybeNewCursor !== null && maybeNewCursor !== oldCursor) {
        break editAfter;
      }
      var cursor = oldCursor;
      var newBefore = newText.slice(0, cursor);
      var newAfter = newText.slice(cursor);
      if (newBefore !== oldBefore) {
        break editAfter;
      }
      var suffixLength = Math.min(oldLength - cursor, newLength - cursor);
      var oldSuffix = oldAfter.slice(oldAfter.length - suffixLength);
      var newSuffix = newAfter.slice(newAfter.length - suffixLength);
      if (oldSuffix !== newSuffix) {
        break editAfter;
      }
      var oldMiddle = oldAfter.slice(0, oldAfter.length - suffixLength);
      var newMiddle = newAfter.slice(0, newAfter.length - suffixLength);
      return make_edit_splice(oldBefore, oldMiddle, newMiddle, oldSuffix);
    }
  }
  if (oldRange.length > 0 && newRange && newRange.length === 0) {
    replaceRange: {
      // see if diff could be a splice of the old selection range
      var oldPrefix = oldText.slice(0, oldRange.index);
      var oldSuffix = oldText.slice(oldRange.index + oldRange.length);
      var prefixLength = oldPrefix.length;
      var suffixLength = oldSuffix.length;
      if (newLength < prefixLength + suffixLength) {
        break replaceRange;
      }
      var newPrefix = newText.slice(0, prefixLength);
      var newSuffix = newText.slice(newLength - suffixLength);
      if (oldPrefix !== newPrefix || oldSuffix !== newSuffix) {
        break replaceRange;
      }
      var oldMiddle = oldText.slice(prefixLength, oldLength - suffixLength);
      var newMiddle = newText.slice(prefixLength, newLength - suffixLength);
      return make_edit_splice(oldPrefix, oldMiddle, newMiddle, oldSuffix);
    }
  }

  return null;
}

function diff(text1, text2, cursor_pos) {
  // only pass fix_unicode=true at the top level, not when diff_main is
  // recursively invoked
  return diff_main(text1, text2, cursor_pos, true);
}

diff.INSERT = DIFF_INSERT;
diff.DELETE = DIFF_DELETE;
diff.EQUAL = DIFF_EQUAL;

var diff_1 = diff;

const {
	showError: showError$1,
	showActionableError: showActionableError$1,
	log: log$2,
	getConfigWithWorkspaceOverride: getConfigWithWorkspaceOverride$1,
} = helpers;

const POSSIBLE_CURSORS = String.fromCharCode(
	0xfffd,
	0xffff,
	0x1f094,
	0x1f08d,
	0xe004,
	0x1f08d
).split('');

const PRETTIER_OPTIONS = [
	'arrowParens',
	'bracketSpacing',
	'endOfLine',
	'htmlWhitespaceSensitivity',
	'insertPragma',
	'jsxBracketSameLine',
	'jsxSingleQuote',
	'printWidth',
	'proseWrap',
	'quoteProps',
	'requirePragma',
	'semi',
	'singleQuote',
	'tabWidth',
	'trailingComma',
	'useTabs',
	'vueIndentScriptAndStyle',
];

class Formatter {
	constructor() {
		this.prettierServiceDidExit = this.prettierServiceDidExit.bind(this);

		this.emitter = new Emitter();

		this.setupIsReadyPromise();
	}

	get defaultConfig() {
		return Object.fromEntries(
			PRETTIER_OPTIONS.map((option) => [
				option,
				getConfigWithWorkspaceOverride$1(`prettier.default-config.${option}`),
			])
		)
	}

	get isReady() {
		if (!this._isReadyPromise) {
			this.showServiceNotRunningError();
			return false
		}

		return this._isReadyPromise
	}

	async start(modulePath) {
		if (modulePath) this.modulePath = modulePath;
		if (this.prettierService) return

		log$2.info('Starting Prettier service');

		if (!this._isReadyPromise) this.setupIsReadyPromise();

		this.prettierService = new Process('/usr/bin/env', {
			args: [
				'node',
				nova.path.join(
					nova.extension.path,
					'Scripts',
					'prettier-service',
					'prettier-service.js'
				),
				this.modulePath,
			],
			stdio: 'jsonrpc',
		});
		this.prettierService.onDidExit(this.prettierServiceDidExit);
		this.prettierService.onNotify('didStart', () => {
			this._resolveIsReadyPromise(true);
		});
		this.prettierService.start();
	}

	stop() {
		nova.notifications.cancel('prettier-not-running');
		if (!this._isReadyPromise) return

		log$2.info('Stopping Prettier service');

		this.prettierService.terminate();
		if (this._resolveIsReadyPromise) this._resolveIsReadyPromise(false);
		this._isReadyPromise = null;
		this.prettierService = null;
	}

	setupIsReadyPromise() {
		this._isReadyPromise = new Promise((resolve) => {
			this._resolveIsReadyPromise = resolve;
		});
	}

	prettierServiceDidExit(exitCode) {
		if (!this.prettierService) return

		console.error(`Prettier service exited with code ${exitCode}`);

		if (this._resolveIsReadyPromise) this._resolveIsReadyPromise(false);
		this._isReadyPromise = null;
		this.prettierService = null;

		if (this.prettierServiceCrashedRecently) {
			return this.showServiceNotRunningError()
		}

		this.prettierServiceCrashedRecently = true;
		setTimeout(() => (this.prettierServiceCrashedRecently = false), 5000);

		this.start();
	}

	showServiceNotRunningError() {
		showActionableError$1(
			'prettier-not-running',
			'Prettier stopped running',
			`Please report report an issue though Extension Library if this problem persits.`,
			['Restart Prettier'],
			(r) => {
				switch (r) {
					case 0:
						this.start();
						break
				}
			}
		);
	}

	async formatEditor(editor, saving, selectionOnly) {
		const { document } = editor;

		nova.notifications.cancel('prettier-unsupported-syntax');

		const pathForConfig = document.path || nova.workspace.path;

		const shouldApplyDefaultConfig = await this.shouldApplyDefaultConfig(
			document,
			saving,
			pathForConfig
		);

		if (shouldApplyDefaultConfig === null) return []

		log$2.info(`Formatting ${document.path}`);

		const documentRange = new Range(0, document.length);
		const original = editor.getTextInRange(documentRange);
		const options = {
			...(document.path
				? { filepath: document.path }
				: { parser: this.getParserForSyntax(document.syntax) }),
			...(shouldApplyDefaultConfig ? this.defaultConfig : {}),
			...(selectionOnly
				? {
						rangeStart: editor.selectedRange.start,
						rangeEnd: editor.selectedRange.end,
				  }
				: {}),
		};

		const result = await this.prettierService.request('format', {
			original,
			pathForConfig,
			ignorePath: saving && this.getIgnorePath(pathForConfig),
			options,
		});

		const { formatted, error, ignored, missingParser } = result;

		if (error) {
			return this.issuesFromPrettierError(error)
		}

		if (ignored) {
			log$2.info(`Prettier is configured to ignore ${document.path}`);
			return []
		}

		if (missingParser) {
			if (!saving) {
				showError$1(
					'prettier-unsupported-syntax',
					`Syntax not supported`,
					`Prettier doesn't include a Parser for this file and no plugin is installed that does.`
				);
			}
			log$2.info(`No parser for ${document.path}`);
			return []
		}

		if (formatted === original) {
			log$2.info(`No changes for ${document.path}`);
			return []
		}

		await this.applyResult(editor, original, formatted);
	}

	async shouldApplyDefaultConfig(document, saving, pathForConfig) {
		// Don't format-on-save ignore syntaxes.
		if (
			saving &&
			nova.config.get(
				`prettier.format-on-save.ignored-syntaxes.${document.syntax}`
			) === true
		) {
			log$2.info(
				`Not formatting (${document.syntax} syntax ignored) ${document.path}`
			);
			return null
		}

		let hasConfig = false;

		if (document.isRemote) {
			// Don't format-on-save remote documents if they're ignored.
			if (
				saving &&
				getConfigWithWorkspaceOverride$1('prettier.format-on-save.ignore-remote')
			) {
				return null
			}
		} else {
			// Try to resolve configuration using Prettier for non-remote documents.
			hasConfig = await this.prettierService.request('hasConfig', {
				pathForConfig,
			});

			if (
				!hasConfig &&
				getConfigWithWorkspaceOverride$1(
					'prettier.format-on-save.ignore-without-config'
				)
			) {
				return null
			}
		}

		return !hasConfig
	}

	getIgnorePath(path) {
		const expectedIgnoreDir = nova.workspace.path || nova.path.dirname(path);
		return nova.path.join(expectedIgnoreDir, '.prettierignore')
	}

	getParserForSyntax(syntax) {
		switch (syntax) {
			case 'javascript':
			case 'jsx':
				return 'babel'
			case 'flow':
				return 'babel-flow'
			default:
				return syntax
		}
	}

	async applyResult(editor, original, formatted) {
		log$2.info(`Applying formatted changes to ${editor.document.path}`);

		const [cursor, edits] = this.diff(
			original,
			formatted,
			editor.selectedRanges
		);

		if (
			original !== editor.getTextInRange(new Range(0, editor.document.length))
		) {
			log$2.info(`Document ${editor.document.path} was changed while formatting`);
			return
		}

		if (edits) {
			return this.applyDiff(editor, cursor, edits)
		}

		return this.replace(editor, formatted)
	}

	diff(original, formatted, selectedRanges) {
		// Find a cursor that does not occur in this document
		const cursor = POSSIBLE_CURSORS.find(
			(cursor) => !original.includes(cursor) && !formatted.includes(cursor)
		);
		// Fall back to not knowing the cursor position.
		if (!cursor) return null

		let originalWithCursors = '';
		let lastEnd = 0;

		for (const selection of selectedRanges) {
			originalWithCursors +=
				original.slice(lastEnd, selection.start) +
				cursor +
				original.slice(selection.start, selection.end) +
				cursor;
			lastEnd = selection.end;
		}

		originalWithCursors += original.slice(lastEnd);

		// Diff
		return [cursor, diff_1(originalWithCursors, formatted)]
	}

	async applyDiff(editor, cursor, edits) {
		const selections = [];
		await editor.edit((e) => {
			let offset = 0;
			let toRemove = 0;

			// Add an extra empty edit so any trailing delete is actually run.
			edits.push([diff_1.EQUAL, '']);

			for (const [edit, str] of edits) {
				if (edit === diff_1.DELETE) {
					toRemove += str.length;

					// Check if the cursors are in here
					let cursorIndex = -1;
					while (true) {
						cursorIndex = str.indexOf(cursor, cursorIndex + 1);
						if (cursorIndex === -1) break

						const lastSelection = selections[selections.length - 1];
						if (!lastSelection || lastSelection[1]) {
							selections[selections.length] = [offset];
						} else {
							lastSelection[1] = offset;
						}
						toRemove -= cursor.length;
					}

					continue
				}

				if (edit === diff_1.EQUAL && toRemove) {
					e.replace(new Range(offset, offset + toRemove), '');
				} else if (edit === diff_1.INSERT) {
					e.replace(new Range(offset, offset + toRemove), str);
				}

				toRemove = 0;
				offset += str.length;
			}
		});

		editor.selectedRanges = selections.map((s) => new Range(s[0], s[1]));
	}

	async replace(editor, formatted) {
		const { document } = editor;

		const cursorPosition = editor.selectedRange.end;
		const documentRange = new Range(0, document.length);

		await editor.edit((e) => {
			e.replace(documentRange, formatted);
		});

		editor.selectedRanges = [new Range(cursorPosition, cursorPosition)];
	}

	issuesFromPrettierError(error) {
		// If the error doesn't have a message just ignore it.
		if (typeof error.message !== 'string') return []

		if (error.name === 'UndefinedParserError') throw error

		// See if it's a simple error
		let lineData = error.message.match(/\((\d+):(\d+)\)\n/m);
		// See if it's a visual error
		if (!lineData) {
			lineData = error.message.match(/^>\s*?(\d+)\s\|\s/m);
			if (lineData) {
				const columnData = error.message.match(/^\s+\|(\s+)\^+($|\n)/im);
				lineData[2] = columnData ? columnData[1].length + 1 : 0;
			}
		}

		if (!lineData) {
			throw error
		}

		const issue = new Issue();
		issue.message = error.stack
			? error.message
			: error.message.split(/\n\s*?at\s+/i)[0]; // When error is only a message it probably has the stack trace appended. Remove it.
		issue.severity = IssueSeverity.Error;
		issue.line = lineData[1];
		issue.column = lineData[2];

		return [issue]
	}
}

var formatter = {
	Formatter,
};

const { showError: showError$2, getConfigWithWorkspaceOverride: getConfigWithWorkspaceOverride$2 } = helpers;
const { Formatter: Formatter$1 } = formatter;

class PrettierExtension {
	constructor(modulePath, prettier, parsers) {
		this.didAddTextEditor = this.didAddTextEditor.bind(this);
		this.toggleFormatOnSave = this.toggleFormatOnSave.bind(this);
		this.editorWillSave = this.editorWillSave.bind(this);
		this.didInvokeFormatCommand = this.didInvokeFormatCommand.bind(this);
		this.didInvokeFormatSelectionCommand = this.didInvokeFormatSelectionCommand.bind(
			this
		);
		this.didInvokeSaveWithoutFormattingCommand = this.didInvokeSaveWithoutFormattingCommand.bind(
			this
		);

		this.modulePath = modulePath;
		this.prettier = prettier;
		this.parsers = parsers;

		this.saveListeners = new Map();
		this.ignoredEditors = new Set();
		this.issueCollection = new IssueCollection();
	}

	setupConfiguration() {
		nova.config.remove('prettier.use-compatibility-mode');

		nova.workspace.config.observe(
			'prettier.format-on-save',
			this.toggleFormatOnSave
		);
		nova.config.observe('prettier.format-on-save', this.toggleFormatOnSave);
	}

	async start() {
		this.setupConfiguration();
		nova.workspace.onDidAddTextEditor(this.didAddTextEditor);
		nova.commands.register('prettier.format', this.didInvokeFormatCommand);
		nova.commands.register(
			'prettier.format-selection',
			this.didInvokeFormatSelectionCommand
		);
		nova.commands.register(
			'prettier.save-without-formatting',
			this.didInvokeSaveWithoutFormattingCommand
		);

		this.formatter = new Formatter$1(this.modulePath);

		try {
			await this.startFormatter().catch(() =>
				new Promise((resolve) => setTimeout(resolve, 1000)).then(() =>
					this.startFormatter()
				)
			);
		} catch (err) {
			if (err.status !== 127) throw err

			return showError$2(
				'prettier-resolution-error',
				`Can't find npm and Prettier`,
				`Prettier couldn't be found because npm isn't available. Please make sure you have Node installed. If you've only installed Node through NVM, you'll need to change your shell configuration to work with Nova. See https://library.panic.com/nova/environment-variables/`
			)
		}
	}

	async startFormatter(e) {
		const path = await prettierInstallation();
		this.formatter.start(path);
	}

	toggleFormatOnSave() {
		this.enabled = getConfigWithWorkspaceOverride$2('prettier.format-on-save');

		if (this.enabled) {
			nova.workspace.textEditors.forEach(this.didAddTextEditor);
		} else {
			this.saveListeners.forEach((listener) => listener.dispose());
			this.saveListeners.clear();
		}
	}

	didAddTextEditor(editor) {
		if (!this.enabled) return

		if (this.saveListeners.has(editor)) return
		this.saveListeners.set(editor, editor.onWillSave(this.editorWillSave));
	}

	async editorWillSave(editor) {
		await this.formatEditor(editor, true, false);
	}

	async didInvokeFormatCommand(editor) {
		await this.formatEditor(editor, false, false);
	}

	async didInvokeFormatSelectionCommand(editor) {
		await this.formatEditor(editor, false, true);
	}

	async didInvokeSaveWithoutFormattingCommand(editor) {
		this.ignoredEditors.add(editor);
		editor.save().finally(() => this.ignoredEditors.delete(editor));
	}

	async formatEditor(editor, isSaving, selectionOnly) {
		if (this.ignoredEditors.has(editor)) return

		try {
			const ready = await this.formatter.isReady;
			if (!ready) return

			const issues = await this.formatter.formatEditor(
				editor,
				isSaving,
				selectionOnly
			);
			this.issueCollection.set(editor.document.uri, issues);
		} catch (err) {
			console.error(err, err.stack);
			showError$2(
				'prettier-format-error',
				`Error while formatting`,
				`"${err.message}" occurred while formatting ${editor.document.path}. See the extension console for more info.`
			);
		}
	}
}

var activate = async function () {
	try {
		const extension = new PrettierExtension();
		await extension.start();
	} catch (err) {
		console.error('Unable to set up prettier service', err, err.stack);

		return showError$2(
			'prettier-resolution-error',
			`Unable to start Prettier`,
			`Please check the extension console for additional logs.`
		)
	}
};

var deactivate = function () {
	// Clean up state before the extension is deactivated
};

var main = {
	activate: activate,
	deactivate: deactivate
};

exports.activate = activate;
exports.deactivate = deactivate;
exports.default = main;
