'use strict';

const runify = require('../');
const assert = require('assert');

const hosts = [
  /*
  ['./hosts/js.exe', 'jsshell'],
  ['./hosts/ch.exe', 'ch'],
  ['c:/program files/nodejs/node.exe', 'node'],
  ['../v8/build/Release/d8.exe', 'd8'],
  /*
  ['C:/Users/brterlso/AppData/Local/Google/Chrome SxS/Application/chrome.exe', 'chrome'],
  /**/
  [undefined, 'chrome'],
  ['C:/Program Files (x86)/Mozilla Firefox/firefox.exe', 'firefox'],
  ['C:/Program Files (x86)/Nightly/firefox.exe', 'firefox'],
  /*
  [undefined, 'firefox'], // no path is also ok for browser agents
/* */
];

hosts.forEach(function (record) {
  const host = record[0];
  const type = record[1];

  describe(`${type} (${host})`, function () {
    this.timeout(10000);
    let agent;

    before(function() {
      return runify.createAgent(type, { hostPath: host }).then(a => agent = a);
    });

    after(function() {
      return agent.destroy();
    });

    it('runs SyntaxErrors', function () {
      return agent.evalScript('foo x++').then(function (result) {
        assert(result.error, 'error is present');
        assert.equal(result.error.name, 'SyntaxError');
        assert.equal(result.stdout, '', 'stdout not present');
      });
    });

    it('runs thrown SyntaxErrors', function () {
      return agent.evalScript('throw new SyntaxError("Custom Message");').then(function (result) {
        assert(result.error, 'error is present');
        assert.equal(result.stdout, '', 'stdout not present');

        assert.equal(result.error.message, 'Custom Message');
        assert.equal(result.error.name, 'SyntaxError');
        assert.equal(result.error.stack[0].lineNumber, 1);
      });
    });

    it('runs thrown TypeErrors', function () {
      return agent.evalScript('throw new TypeError("Custom Message");').then(function (result) {
        assert(result.error, 'error is present');
        assert.equal(result.stdout, '', 'stdout not present');

        assert.equal(result.error.message, 'Custom Message');
        assert.equal(result.error.name, 'TypeError');
        assert.equal(result.error.stack[0].lineNumber, 1);
      });
    });

    it('runs thrown RangeErrors', function () {
      return agent.evalScript('throw new RangeError("Custom Message");').then(function (result) {
        assert(result.error, 'error is present');
        assert.equal(result.stdout, '', 'stdout not present');

        assert.equal(result.error.message, 'Custom Message');
        assert.equal(result.error.name, 'RangeError');
        assert.equal(result.error.stack[0].lineNumber, 1);
      });
    });

    it('runs thrown Errors', function () {
      return agent.evalScript('throw new Error("Custom Message");').then(function (result) {
        assert.equal(result.stdout, '', 'stdout not present');
        assert(result.error, 'error is present');
        assert.equal(result.error.message, 'Custom Message');
        assert.equal(result.error.name, 'Error');
      });
    });

    it('runs thrown custom Errors', function () {
      return agent.evalScript('function Foo1Error(msg) { this.name = "Foo1Error"; this.message = msg }; Foo1Error.prototype = Error.prototype; throw new Foo1Error("Custom Message");').then(function (result) {
        assert.equal(result.stdout, '', 'stdout not present');
        assert(result.error, 'error is present');
        assert.equal(result.error.message, 'Custom Message');
        assert.equal(result.error.name, 'Foo1Error');
      });
    });

    it('gathers stdout', function () {
      return agent.evalScript('print("foo")').then(function(result) {
        assert(result.stdout.match(/^foo\r?\n/), 'Unexpected stdout: ' + result.stdout);
      });
    });

    it('can eval in new realms', function () {
      return agent.evalScript(`
        var x = 2;
        $child = $.createRealm();
        $child.evalScript("var x = 1; print(x);");
        print(x);
      `).then(function(result) {
        assert(result.stdout.match(/^1\r?\n2\r?\n/m), 'Unexpected stdout: ' + result.stdout + result.stderr);
      });
    });

    it('can create new realms', function() {
      return agent.evalScript(`
        var sub$ = $.createRealm({});
        sub$.evalScript("var x = 1");
        sub$.evalScript("print(x)");
        subsub$ = sub$.createRealm({});
        subsub$.evalScript("var x = 2");
        subsub$.evalScript("print(2)");
      `).then(function(result) {
        assert(result.stdout.match(/^1\r?\n2\r?\n/m), 'Unexpected stdout: ' + result.stdout + result.stderr);
      });
    });

    it('can set globals in new realms', function () {
      return agent.evalScript(`
        var x = 1;
        $child = $.createRealm({globals: {x: 2}});
        $child.evalScript("print(x);");
      `).then(function(result) {
        assert(result.stdout.match(/^2\r?\n/m), 'Unexpected stdout: ' + result.stdout + result.stderr);
      });
    });

    it('can eval in new scripts', function () {
      return agent.evalScript(`
        var x = 2;
        $.evalScript("x = 3;");
        print(x);
      `).then(function(result) {
        assert(result.stdout.match(/^3\r?\n/m), 'Unexpected stdout: ' + result.stdout + result.stderr);
      });
    });

    it('returns errors from evaling in new script', function () {
      return agent.evalScript(`
        var completion = $.evalScript("x+++");
        print(completion.value.name);
      `).then(function(result) {
        assert(result.stdout.match(/^SyntaxError\r?\n/m), 'Unexpected stdout: ' + result.stdout + result.stderr);
      });
    });

    it('can eval lexical bindings in new scripts', function () {
      return agent.evalScript(`
        $.evalScript("'use strict'; let x = 3;");
        print(x);
      `).then(function(result) {
        assert(result.stdout.match(/^3\r?\n/m), 'Unexpected stdout: ' + result.stdout + result.stderr);
      });
    });

    it('can set properties in new realms', function() {
      return agent.evalScript(`
        var sub$ = $.createRealm({});
        sub$.evalScript("var x = 1");
        sub$.evalScript("print(x)");

        sub$.setGlobal("x", 2);

        sub$.evalScript("print(x)");
      `).then(function(result) {
        assert(result.stdout.match(/^1\r?\n2\r?\n/m), 'Unexpected stdout: ' + result.stdout + result.stderr);
      });
    });

    it('can access properties from new realms', function() {
      return agent.evalScript(`
        var sub$ = $.createRealm({});
        sub$.evalScript("var x = 1");

        print(sub$.getGlobal("x"));
      `).then(function(result) {
        assert(result.stdout.match(/^1\r?\n/m), 'Unexpected stdout: ' + result.stdout + result.stderr);
      });
    });

    it('runs async code', function () {
      return agent.evalScript(`
        if ($.global.Promise === undefined) {
          print('async result');
          $.destroy()
        } else {
          Promise.resolve().then(function () {
            print('async result');
            $.destroy()
          });
        }
      `, { async: true }).then(result => {
        assert(result.stdout.match(/async result/), 'Unexpected stdout: ' + result.stdout + result.stderr);
      });
    });

    it('runs in the proper mode', function () {
      return agent.evalScript(`
        "use strict"
        function foo() { print(this === undefined) }
        foo();
      `)
      .then(function(result) {
        assert(result.stdout.match(/^true\r?\n/m), 'Unexpected stdout: ' + result.stdout + result.stderr);

        return agent.evalScript(`
          'use strict'
          function foo() { print(this === undefined) }
          foo();
        `);
      })
      .then(function(result) {
        assert(result.stdout.match(/^true\r?\n/m), 'Unexpected stdout: ' + result.stdout + result.stderr);

        return agent.evalScript(`
          function foo() { print(this === Function('return this;')()) }
          foo();
        `);
      })
      .then(function(result) {
        assert(result.stdout.match(/^true\r?\n/m), 'Unexpected stdout: ' + result.stdout + result.stderr);

        return agent.evalScript(`
          /*---
          ---*/
          "use strict";
          function foo() { print(this === undefined) }
          foo();
        `);
      })
      .then(function(result) {
        assert(result.stdout.match(/^true\r?\n/m), 'Unexpected stdout: ' + result.stdout + result.stderr);

        return agent.evalScript(`
          /*---
          ---*/
          " some other prolog "
          "use strict";
          function foo() { print(this === undefined) }
          foo();
        `);
      })
      .then(function(result) {
        assert(result.stdout.match(/^true\r?\n/m), 'Unexpected stdout: ' + result.stdout + result.stderr);

        return agent.evalScript(`
          // normal comment
          /*---
          ---*/
          " some other prolog "
          // another comment
          "use strict";
          function foo() { print(this === undefined) }
          foo();
        `);
      })
      .then(function(result) {
        assert(result.stdout.match(/^true\r?\n/m), 'Unexpected stdout: ' + result.stdout + result.stderr);
      });
    });
  });
});
