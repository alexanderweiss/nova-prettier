'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var prettier = require('./prettier.js');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var prettier__default = /*#__PURE__*/_interopDefaultLegacy(prettier);

/** Class for managing external NPM module executables in Nova extensions */
var NPMExecutable_1 = class NPMExecutable
{
	/**
	 * @param {string} binName - The name of the executable found in `node_modules/.bin`
	 */
	constructor( binName )
	{
		this.binName = binName;
		this.PATH = null;
	}

	/**
	 * Install NPM dependencies inside the extension bundle.
	 *
	 * @return {Promise}
	 */
	install()
	{
		let pathPackage = nova.path.join( nova.extension.path, "package.json" );
		if( !nova.fs.access( pathPackage, nova.fs.F_OK ) )
		{
			return Promise.reject( `No such file "${pathPackage}"` );
		}

		return new Promise( (resolve, reject) =>
		{
			let options = {
				args: ["npm", "install", "--only=prod"],
				cwd: nova.extension.path,
			};

			let npm = new Process( "/usr/bin/env", options );
			let errorLines = [];
			npm.onStderr( line => errorLines.push( line.trimRight() ) );
			npm.onDidExit( status =>
			{
				status === 0 ? resolve() : reject( new Error( errorLines.join( "\n" ) ) );
			});

			npm.start();
		})
	}

	/**
	 * Whether the module has been installed inside the extension bundle.
	 *
	 * NOTE: This is unrelated to whether the module has been installed globally
	 * or locally to a given project.
	 *
	 * @return {Boolean}
	 */
	get isInstalled()
	{
		let pathBin = nova.path.join( nova.extension.path, "node_modules/.bin/", this.binName );
		return nova.fs.access( pathBin, nova.fs.F_OK );
	}

	/**
	 * Helper function for instantiating Process object with options needed to
	 * run the module executable using `npx`.
	 *
	 * @param {Object} processOptions
	 * @param {[string]} [processOptions.args]
	 * @param {string} [processOptions.cwd]
	 * @param {Object} [processOptions.env]
	 * @param {string|boolean} [processOptions.shell]
	 * @param {[string]} [processOptions.stdio]
	 * @see {@link https://novadocs.panic.com/api-reference/process}
	 * @return {Promise<Process>}
	 */
	async process( { args=[], cwd, env={}, shell=true, stdio } )
	{
		let options = {
			args: ["npx", this.binName].concat( args ),
			cwd: cwd || nova.extension.path,
			env: env,
			shell: shell,
		};

		if( stdio )
		{
			options.stdio = stdio;
		}

		if( this.PATH === null )
		{
			// Environment.environment added in 1.0b8
			if( nova.environment && nova.environment.PATH )
			{
				this.PATH = nova.environment.PATH;
			}
			else
			{
				this.PATH = await getEnv( "PATH" );
			}
		}

		/* The current workspace path (if any) and the extension's path are
		 * added to the user's $PATH, creating a preferential cascade of
		 * possible executable locations:
		 *
		 *   Current Workspace > Global Installation > Extension Fallback
		 */
		let paths = [];
		if( nova.workspace.path )
		{
			paths.push( nova.workspace.path );
		}
		paths.push( this.PATH );
		paths.push( nova.extension.path );

		options.env.PATH = paths.join( ":" );

		return new Process( "/usr/bin/env", options );
	}
};

/**
 * Helper function for fetching variables from the user's environment
 *
 * @param {string} key
 * @return {Promise<string>}
 */
function getEnv( key )
{
	return new Promise( resolve =>
	{
		let env = new Process( "/usr/bin/env", { shell: true } );

		env.onStdout( line =>
		{
			if( line.indexOf( key ) === 0 )
			{
				resolve( line.trimRight().split( "=" )[1] );
			}
		});

		env.onDidExit( () => resolve() );

		env.start();
	});
}

var npmExecutable = {
	NPMExecutable: NPMExecutable_1
};

const { NPMExecutable } = npmExecutable;

// TODO: Duplicate code in ./prettier.js (except onStdout handler)
async function checkPrettierVersion() {
	let resolve, reject;
	const promise = new Promise((_resolve, _reject) => {
		resolve = _resolve;
		reject = _reject;
	});

	const process = new Process('/usr/bin/env', {
		args: ['npm', 'll', 'prettier', '--parseable', '--depth', '0'],
		cwd: nova.extension.path,
	});

	process.onStdout((result) => {
		if (!result) return resolve(null)

		const [_, name, status] = result.split(':');
		if (!name.startsWith('prettier@')) return resolve(false)
		if (status === 'INVALID') return resolve(false)
		resolve(true);
	});

	const errors = [];
	process.onStderr((err) => {
		errors.push(err);
	});

	process.onDidExit((status) => {
		if (status === '0') return
		reject(errors.join('\n'));
	});

	process.start();

	return promise
}

var install = async () => {
	try {
		const prettier = new NPMExecutable('prettier');
		if (!prettier.isInstalled) {
			console.log('Extension prettier not installed, installing');
			await prettier.install();
		} else if (!(await checkPrettierVersion())) {
			console.log('Extension prettier out of date, updating/installing');
			await prettier.install();
		}
	} catch (err) {
		console.error('Unable to find or install prettier', err, err.stack);
	}
};

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

var helpers = {
	showError,
	showActionableError,
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

const { showError: showError$1, showActionableError: showActionableError$1 } = helpers;

const POSSIBLE_CURSORS = String.fromCharCode(
	0xfffd,
	0xffff,
	0x1f094,
	0x1f08d,
	0xe004,
	0x1f08d
).split('');

class Formatter {
	constructor() {
		this.formattedText = new Map();
		this.emitter = new Emitter();
	}

	get isReady() {
		return true
	}

	start() {}
	stop() {}

	onFatalError(callback) {
		this.emitter.on('fatalError', callback);
	}

	// runPrettier() {}

	async formatEditor(editor, shouldSave) {
		const { document } = editor;

		if (
			shouldSave &&
			nova.config.get(
				`prettier.format-on-save.ignored-syntaxes.${document.syntax}`
			) === true
		) {
			console.log(
				`Not formatting (${document.syntax}) syntax ignored) ${document.path}`
			);
			return []
		}

		console.log(`Formatting ${document.path}`);

		const documentRange = new Range(0, document.length);
		const text = editor.getTextInRange(documentRange);

		// Skip formatting if the current text matches a saved formatted version
		const previouslyFormattedText = this.formattedText.get(editor);
		if (previouslyFormattedText) {
			this.formattedText.delete(editor);
			if (previouslyFormattedText === text) return
		}

		const pathForConfig = document.path || nova.workspace.path;
		const syntax = document.syntax;
		const selectionStart = editor.selectedRange.start;
		const selectionEnd = editor.selectedRange.end;
		const options = {
			...(document.path
				? { filepath: document.path }
				: { parser: this.parserForSyntax(syntax) }),
			cursorOffset: selectionEnd,
		};

		let result;
		try {
			result = await this.runPrettier(
				text,
				pathForConfig,
				syntax,
				shouldSave,
				options
			);
		} catch (err) {
			return this.issuesFromPrettierError(err)
		}

		if (!result) {
			// TODO: Show warning when formatting using command.
			console.log(`No result (ignored or no parser) for ${document.path}`);
			return []
		}

		const { formatted } = result;
		if (formatted === text) {
			console.log(`No changes for ${document.path}`);
			return []
		}

		console.log(`Applying formatted changes to ${document.path}`);
		let editPromise = this.applyResult(editor, result, {
			text,
			selectionStart,
			selectionEnd,
		});
		if (shouldSave) {
			editPromise = editPromise.then(() => {
				this.ensureSaved(editor, formatted);
			});
		}
		editPromise.catch((err) => console.error(err, err.stack));
	}

	issuesFromPrettierError(error) {
		const name = error.name || error.constructor.name;
		if (name === 'UndefinedParserError') throw error

		// See if it's a proper syntax error
		let lineData = error.message.match(/\((\d+):(\d+)\)\n/m);
		// See if it's a PHP syntax error
		if (!lineData) {
			lineData = error.message.match(/on line (\d+)\n/m);
			if (lineData) {
				const columnData = error.message.match(/\|(\s+)\^\n/m);
				if (columnData) lineData[2] = columnData[1].length;
			}
		}

		if (!lineData) {
			throw error
		}

		const issue = new Issue();
		issue.message = error.message;
		issue.severity = IssueSeverity.Error;
		issue.line = lineData[1];
		issue.column = lineData[2];

		return [issue]
	}

	async applyResult(editor, { formatted, cursorOffset }) {
		const { document } = editor;
		const documentRange = new Range(0, document.length);

		const editPromise = editor.edit((e) => {
			e.replace(documentRange, formatted);
		});

		editPromise.then(() => {
			editor.selectedRanges = [new Range(cursorOffset, cursorOffset)];
		});

		return editPromise
	}

	ensureSaved(editor, formatted) {
		const { document } = editor;

		if (!document.isDirty) return
		if (document.isClosed) return
		if (document.isUntitled) return

		const documentRange = new Range(0, document.length);
		const text = editor.getTextInRange(documentRange);
		if (formatted !== text) return

		// Our changes weren't included in the save because it took too
		// long. Save it once more but skip formatting for that save.
		this.formattedText.set(editor, formatted);
		editor.save();
	}

	ignorePath(path) {
		const expectedIgnoreDir = nova.workspace.path || nova.path.dirname(path);
		return nova.path.join(expectedIgnoreDir, '.prettierignore')
	}

	parserForSyntax(syntax) {
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
}

class SubprocessFormatter extends Formatter {
	constructor(modulePath) {
		super();
		this.modulePath = modulePath;

		this.prettierServiceDidExit = this.prettierServiceDidExit.bind(this);
	}

	get isReady() {
		if (!this._isReadyPromise) {
			this.showServiceNotRunningError();
			return false
		}

		return this._isReadyPromise
	}

	async start() {
		if (this._isReadyPromise) return

		console.log('Starting Prettier service');

		this._isReadyPromise = new Promise((resolve) => {
			this._resolveIsReadyPromise = resolve;
		});

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

		console.log('Stopping Prettier service');

		this.prettierService.terminate();
		if (this._resolveIsReadyPromise) this._resolveIsReadyPromise(false);
		this._isReadyPromise = null;
		this.prettierService = null;
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
			`Try restarting, or run in compatibility mode instead (also available in settings). If you do, please check the Extension Console for log output and report an issue though Extension Library.`,
			['Use compatibility mode', 'Restart Prettier'],
			(r) => {
				switch (r) {
					case 0:
						nova.config.set('prettier.use-compatibility-mode', true);
						break
					case 1:
						this.start();
						break
				}
			}
		);
	}

	async runPrettier(text, pathForConfig, syntax, shouldSave, options) {
		delete options.cursorOffset;

		const result = await this.prettierService.request('format', {
			text,
			pathForConfig,
			ignorePath: shouldSave && this.ignorePath(pathForConfig),
			syntax,
			options,
		});

		if (!result || !result.error) return result

		const error = new Error();
		error.name = result.error.name;
		error.message = result.error.message;
		error.stack = result.error.stack;

		throw error
	}

	async applyResult(editor, result, options) {
		const { formatted } = result;
		const { text, selectionStart, selectionEnd } = options;

		// TODO: Multi-cursor support.

		// Find a cursor that does not occur in this document
		const cursor = POSSIBLE_CURSORS.find(
			(cursor) => !text.includes(cursor) && !formatted.includes(cursor)
		);
		// Fall back to not knowing the cursor position.
		if (!cursor) return super.applyResult(editor, result, options)

		// Insert the cursors
		const textWithCursor =
			text.slice(0, selectionStart) +
			cursor +
			text.slice(selectionStart, selectionEnd) +
			cursor +
			text.slice(selectionEnd);

		// Diff
		const edits = diff_1(textWithCursor, formatted);

		if (text !== editor.getTextInRange(new Range(0, editor.document.length))) {
			console.log(
				`Document ${editor.document.path} was changed while formatting`
			);
			return
		}

		let newSelectionStart;
		let newSelectionEnd;
		const editPromise = editor.edit((e) => {
			let offset = 0;
			let toRemove = 0;

			for (const [edit, str] of edits) {
				if (edit === diff_1.DELETE) {
					toRemove += str.length;

					// Check if the cursors are in here
					let cursorIndex = -1;
					while (true) {
						cursorIndex = str.indexOf(cursor, cursorIndex + 1);
						if (cursorIndex === -1) break
						newSelectionStart
							? (newSelectionEnd = offset)
							: (newSelectionStart = offset);
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

		editPromise
			.then(() => {
				editor.selectedRanges = [new Range(newSelectionStart, newSelectionEnd)];
			})
			.catch((err) => console.error(err));
		return editPromise
	}
}

class RuntimeFormatter extends Formatter {
	constructor(modulePath, prettier, parsers) {
		super();

		this.modulePath = modulePath;
		this.prettier = prettier;
		this.parsers = parsers;

		this.configs = new Map();
	}

	start() {
		console.log('Starting runtime formatter');
	}

	async getConfigForPath(path) {
		// TODO: Invalidate cache at some point?
		if (this.configs.has(path)) return this.configs.get(path)

		const config = await this.resolveConfigForPath(path);
		this.configs.set(path, config);

		return config
	}

	async resolveConfigForPath(path) {
		let resolve, reject;
		const promise = new Promise((_resolve, _reject) => {
			resolve = _resolve;
			reject = _reject;
		});

		const process = new Process('/usr/bin/env', {
			args: [
				'node',
				nova.path.join(nova.extension.path, 'Scripts', 'config.js'),
				this.modulePath,
				this.ignorePath(path),
				path,
			],
		});

		const errors = [];

		process.onStdout((result) => {
			try {
				resolve(JSON.parse(result));
			} catch (err) {
				reject(err);
			}
		});
		process.onStderr((err) => {
			errors.push(err);
		});
		process.onDidExit((status) => {
			if (status === '0') return
			reject(errors.join('\n'));
		});
		process.start();

		return promise
	}

	showConfigResolutionError(path) {
		showError$1(
			'prettier-config-resolution-error',
			'Failed to resolve Prettier configuration',
			`File to be formatted: ${path}`
		);
	}

	async runPrettier(text, pathForConfig, syntax, _shouldSave, options) {
		let config = {};
		let info = {};

		// Don't handle PHP syntax. Required because Nova considers PHP a
		// sub-syntax of HTML and enables the command.
		if (syntax === 'php') return null

		if (pathForConfig) {
			try {
				// TODO: Always format when shouldSave === false
				;({ config, info } = await this.getConfigForPath(pathForConfig));
			} catch (err) {
				console.warn(
					`Unable to get config for ${pathForConfig}: ${err}`,
					err.stack
				);
				this.showConfigResolutionError(pathForConfig);
			}
		}

		if (options.filepath && info.ignored === true) return null
		if (!options.parser && !info.inferredParser) return null

		return this.prettier.formatWithCursor(text, {
			...config,
			...options,
			plugins: this.parsers,
		})
	}
}

var formatter = {
	SubprocessFormatter,
	RuntimeFormatter,
};

const { showError: showError$2 } = helpers;
const { SubprocessFormatter: SubprocessFormatter$1, RuntimeFormatter: RuntimeFormatter$1 } = formatter;

class PrettierExtension {
	constructor(modulePath, prettier, parsers) {
		this.modulePath = modulePath;
		this.prettier = prettier;
		this.parsers = parsers;

		this.didAddTextEditor = this.didAddTextEditor.bind(this);
		this.toggleFormatOnSave = this.toggleFormatOnSave.bind(this);
		this.editorWillSave = this.editorWillSave.bind(this);
		this.didInvokeFormatCommand = this.didInvokeFormatCommand.bind(this);
		this.toggleFormatter = this.toggleFormatter.bind(this);

		this.saveListeners = new Map();
		this.issueCollection = new IssueCollection();

		this.setupConfiguration();
		nova.workspace.onDidAddTextEditor(this.didAddTextEditor);
		nova.commands.register('prettier.format', this.didInvokeFormatCommand);
	}

	setupConfiguration() {
		nova.workspace.config.observe(
			'prettier.format-on-save',
			this.toggleFormatOnSave
		);
		nova.config.observe('prettier.format-on-save', this.toggleFormatOnSave);
		nova.config.observe('prettier.use-compatibility-mode', this.toggleFormatter);
	}

	toggleFormatter(useCompatibilityMode) {
		if (this.formatter) this.formatter.stop();
		this.formatter = useCompatibilityMode
			? new RuntimeFormatter$1(this.modulePath, this.prettier, this.parsers)
			: new SubprocessFormatter$1(this.modulePath);
		this.formatter.start();
	}

	getFormatOnSaveWorkspaceConfig() {
		switch (nova.workspace.config.get('prettier.format-on-save')) {
			case 'Enable':
				return true
			case 'Disable':
				return false
			// Upgrade old format
			case true:
				nova.workspace.config.set(
					'prettier.format-on-save',
					nova.config.get('prettier.format-on-save') === true
						? 'Global Default'
						: 'Enable'
				);
				return true
			case false:
				nova.workspace.config.set(
					'prettier.format-on-save',
					nova.config.get('prettier.format-on-save') === false
						? 'Global Default'
						: 'Disable'
				);
				return false
			// No preference -> "Global default"
			default:
				return null
		}
	}

	toggleFormatOnSave() {
		const workspaceConfig = this.getFormatOnSaveWorkspaceConfig();
		const extensionConfig = nova.config.get('prettier.format-on-save');
		if (workspaceConfig !== null) {
			this.enabled = workspaceConfig;
		} else if (extensionConfig !== null) {
			this.enabled = extensionConfig;
		} else {
			this.enabled = true;
		}

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
		this.formatEditor(editor, true);
	}

	async didInvokeFormatCommand(editor) {
		this.formatEditor(editor, false);
	}

	async formatEditor(editor, isSaving) {
		try {
			const ready = await this.formatter.isReady;
			if (!ready) return

			const issues = await this.formatter.formatEditor(editor, isSaving);
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
		await install();
		const { modulePath, prettier, parsers } = await prettier__default['default']();

		const extension = new PrettierExtension(modulePath, prettier, parsers);
	} catch (err) {
		console.error('Unable to set up prettier service', err, err.stack);

		if (err.status === 127) {
			return showError$2(
				'prettier-resolution-error',
				`Can't find npm and Prettier`,
				`Prettier couldn't be found because npm isn't available. Please make sure you have Node installed. If you've only installed Node through NVM, you'll need to change your shell configuration to work with Nova. See https://library.panic.com/nova/environment-variables/`
			)
		}

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
