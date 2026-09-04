(function(root) {
  'use strict';

  function shuffled(values, random) {
    var result = values.slice();
    for (var i = result.length - 1; i > 0; i -= 1) {
      var j = Math.floor(random() * (i + 1));
      var value = result[i]; result[i] = result[j]; result[j] = value;
    }
    return result;
  }

  // Choose complete existing spreads, never half of a diptych.
  function pickSelection(units, previousIds, random) {
    random = random || Math.random;
    var previous = new Set(previousIds || []);
    var total = units.reduce(function(n, unit) { return n + unit.photos.length; }, 0);
    var target = Math.min(total, 3 + Math.floor(random() * 3));
    var fresh = units.filter(function(unit) {
      return unit.photos.every(function(photo) { return !previous.has(photo.id); });
    });

    function exact(pool, amount) {
      var failed = new Set();
      function search(index, remaining) {
        if (!remaining) return [];
        if (index === pool.length) return null;
        var key = index + ':' + remaining;
        if (failed.has(key)) return null;
        var size = pool[index].photos.length;
        if (size <= remaining) {
          var rest = search(index + 1, remaining - size);
          if (rest) return [pool[index]].concat(rest);
        }
        var skipped = search(index + 1, remaining);
        if (skipped) return skipped;
        failed.add(key);
        return null;
      }
      return search(0, amount);
    }

    var result = exact(shuffled(fresh, random), target);
    if (!result) {
      var pool = shuffled(units, random);
      while (target > 0 && !result) result = exact(pool, target--);
    }
    result = result || [];
    // Give a single photograph room to lead when this draw contains one.
    var lead = result.findIndex(function(unit) { return unit.photos.length === 1; });
    if (lead > 0) result.unshift(result.splice(lead, 1)[0]);
    return result;
  }

  function composeSelection(units) {
    var rows = [];
    units.forEach(function(unit, index) {
      var last = rows[rows.length - 1];
      var photo = unit.photos[0];
      var ratio = photo.full.width / photo.full.height;
      if (index > 1 && last && !last.lead && last.photos.length === 1 && unit.photos.length === 1) {
        var other = last.photos[0].full;
        var otherRatio = other.width / other.height;
        // Similar visual scale; avoid making a narrow portrait a tiny side image.
        if (Math.max(ratio, otherRatio) / Math.min(ratio, otherRatio) <= 1.8 && ratio + otherRatio >= 1) {
          last.photos.push(photo);
          last.counterpoint = true;
          return;
        }
      }
      rows.push({ photos: unit.photos.slice(), lead: index === 0 && unit.photos.length === 1 });
    });
    var ending = rows[rows.length - 1];
    if (ending && !ending.lead && ending.photos.length === 1) {
      ending.coda = ending.photos[0].full.width >= ending.photos[0].full.height;
    }
    return rows;
  }

  var api = { pickSelection: pickSelection, composeSelection: composeSelection };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BlueNoteSelection = api;
})(typeof window === 'undefined' ? this : window);
