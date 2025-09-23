// UMD wrapper for Superpowered.js
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    // CommonJS
    module.exports = factory();
  } else {
    // Browser globals
    const { SuperpoweredGlue, SuperpoweredWebAudio } = factory();
    root.SuperpoweredGlue = SuperpoweredGlue;
    root.SuperpoweredWebAudio = SuperpoweredWebAudio;
  }
}(typeof self !== 'undefined' ? self : this, function () {
  // Import the ES6 module and return its exports
  // This will be replaced with the actual module content
  return {
    SuperpoweredGlue: null,
    SuperpoweredWebAudio: null
  };
}));
