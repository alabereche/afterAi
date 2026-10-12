// Zero-dependency Line-by-Line Diff Engine for Studio Code Inspection
// Generates unified diff hunks and addition/deletion counts between two file strings.

/**
 * Computes line-level diff between oldContent and newContent
 * @param {string} oldContent - Original file content
 * @param {string} newContent - Modified file content
 * @param {string} filePath - Path or label for display (e.g. "src/Scene.tsx")
 * @param {number} contextLines - Number of context lines around changes (default: 3)
 * @returns {{ file: string, additions: number, deletions: number, changed: boolean, hunks: Array<{ type: 'add' | 'delete' | 'context', content: string, oldLineNumber?: number, newLineNumber?: number }> }}
 */
export function computeFileDiff(oldContent, newContent, filePath = 'file', contextLines = 3) {
  if (oldContent === newContent) {
    return {
      file: filePath,
      additions: 0,
      deletions: 0,
      changed: false,
      hunks: [],
    };
  }

  const oldLines = (oldContent || '').replace(/\r\n/g, '\n').split('\n');
  const newLines = (newContent || '').replace(/\r\n/g, '\n').split('\n');

  // Compute Longest Common Subsequence (LCS) matrix for line matches
  // To avoid huge matrices on very large files, limit max lines or use windowed diff
  const N = oldLines.length;
  const M = newLines.length;

  // Use dynamic programming LCS table
  // Optimized for typical code files up to 3000 lines
  const lcs = [];
  for (let i = 0; i <= N; i++) {
    lcs[i] = new Uint16Array(M + 1);
  }

  for (let i = 0; i < N; i++) {
    for (let j = 0; j < M; j++) {
      if (oldLines[i] === newLines[j]) {
        lcs[i + 1][j + 1] = lcs[i][j] + 1;
      } else {
        lcs[i + 1][j + 1] = Math.max(lcs[i + 1][j], lcs[i][j + 1]);
      }
    }
  }

  // Backtrack to find diff operations
  const rawDiff = [];
  let i = N;
  let j = M;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      rawDiff.push({
        type: 'context',
        content: oldLines[i - 1],
        oldLine: i,
        newLine: j,
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || lcs[i][j - 1] >= lcs[i - 1][j])) {
      rawDiff.push({
        type: 'add',
        content: newLines[j - 1],
        newLine: j,
      });
      j--;
    } else if (i > 0 && (j === 0 || lcs[i][j - 1] < lcs[i - 1][j])) {
      rawDiff.push({
        type: 'delete',
        content: oldLines[i - 1],
        oldLine: i,
      });
      i--;
    }
  }

  rawDiff.reverse();

  let additions = 0;
  let deletions = 0;

  for (const item of rawDiff) {
    if (item.type === 'add') additions++;
    else if (item.type === 'delete') deletions++;
  }

  // Filter diff items to show changed lines and surrounding context lines
  const keepIndices = new Set();
  for (let k = 0; k < rawDiff.length; k++) {
    if (rawDiff[k].type === 'add' || rawDiff[k].type === 'delete') {
      const start = Math.max(0, k - contextLines);
      const end = Math.min(rawDiff.length - 1, k + contextLines);
      for (let c = start; c <= end; c++) {
        keepIndices.add(c);
      }
    }
  }

  const hunks = [];
  let lastIndex = -1;

  for (let k = 0; k < rawDiff.length; k++) {
    if (!keepIndices.has(k)) continue;

    if (lastIndex !== -1 && k > lastIndex + 1) {
      // Separator between disjoint diff chunks
      hunks.push({
        type: 'separator',
        content: '...',
      });
    }

    const item = rawDiff[k];
    hunks.push({
      type: item.type,
      content: item.content,
      oldLineNumber: item.oldLine,
      newLineNumber: item.newLine,
    });
    lastIndex = k;
  }

  return {
    file: filePath,
    additions,
    deletions,
    changed: additions > 0 || deletions > 0,
    hunks,
  };
}
