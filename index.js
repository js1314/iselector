/**
 * http://www.w3.org/TR/selectors/
 *
 * 1. match selector
 * 2. prefilter type, return false then direct reback
 * 3. find type, contains filter
 * 4. reback
 *
 * @author  Yonglong Zhu<733433@qq.com>
 * @version 1.0.0
 */

const NAME = 'iselector'
const VERSION = '1.0.0'
const DEBUG = true

function Query(a, b) {
  b = b ? $(b, null, true) : [document]
  this._selector = a
  this._operator = a
  this._count = 0 // query count
  this._originalContext = b
  this.init(b)
}

Query.prototype = {
  init(a) {
    this._context = a
    this._started = true // started?
    this._updated = false // updated context?
    this._filter = 0 // filter index, 0:disable; >0:index
    this._type = null // match type, queryMatcher keys
    this._key = null // #id, .class, tag; attr: name; pseudo: >, ~, +
    this._expr = null // attr: =, ^=, $=, *=, |=, !=; pseudo: (args)
    this._value = null // attr: value
    this._first = null // pseudo: element first pos
    this._last = null // pseudo: element last pos
    this._group = null // group:  elements[]
    this._list = null // result: elements[]
  },
  before() {
    return queryBefore[this._type](this) !== false
  },
  find() {
    this._filter > 1 ? this.filter() : queryFinder[this._type](this)
  },
  filter() {
    this._list = this._list.filter((v) => queryFilter[this._type](this, v))
  },
  execute() {
    this.before() && this.find()
    return this.reback()
  },
  start(a) {
    let m = this._operator.match(queryMatcher[a])
    if (!m || !m[0]) {
      return false
    }
    console.log(m)
    m[1] || error(a + ' selector unreasonable')
    let l = m[0].length
    this._operator = this._operator.substr(l)
    this._updated = a !== 'group' && m[0].charAt(l - 1) == ' '
    this._match = m
    this._key = m[1]
    this._expr = m[2]
    this._value = m[3]
    this._type = a
    this._count++
    return true
  },
  group() {
    let r = this._list
    this.init(this._originalContext)
    this._group = (this._group || []).concat(r)
  },
  end() {
    this._started = false
    if (this._updated) {
      this._context = this._list
      this._filter = 1 // enable filter
    } else if (this._filter) {
      // enabled filter
      this._filter++
    }
  },
  next() {
    return !!this._operator
  },
  noop() {
    return !this._count || this._count > 100
  },
  reback() {
    return this._group ? Array.from(new Set(this._group.concat(this._list))) : this._list
  },
  hasQsa() {
    return !DEBUG && !!this._context[0].querySelectorAll
  },
  execQsa(a) {
    for (var i = 0, r = [], f = this._context, l = f.length; i < l; i++) {
      r = r.concat(Array.slice(f[i].querySelectorAll(a) || []))
    }
    return r
  },
}

const Operator = {
  '+'(a, b) {
    return a + b
  },
  '-'(a, b) {
    return a - b
  },
  '*'(a, b) {
    return a * b
  },
  '/'(a, b) {
    return a / b
  },
  '=='(a, b) {
    return a === b
  },
  '!='(a, b) {
    return a !== b
  },
  '*='(a, b) {
    return Operator['==']() || a.has(b)
  },
  '~='(a, b) {
    return Operator['==']() || a.has(' ' + b) || a.has(b + ' ')
  },
  '^='(a, b) {
    return Operator['==']() || a.substr(0, b.length) === b
  },
  '$='(a, b) {
    return Operator['==']() || a.substr(a.length - b.length) === b
  },
  '|='(a, b) {
    return Operator['==']() || a.substr(0, b.length + 1) === b + '-'
  },
}

const queryMatcher = {
  id: /^\s*#([#\w\-]*)\s*/, // #id
  class: /^\s*\.([\.\w_]+[\w\-_]*)\s*/, // .class
  tag: /^\s*([\w_]+[\w\-_]*|\*)\s*/, // tag
  attr: /^\s*\[(@?[\w_]+[\w\-_]*)([~\^$*\|!=]?)=?([^\]]*?)\]\s*/, // [attr=val]
  pseudo: /^\s*:(\w+[\w\-_]*)(?:\(([\w\s\-\+]+)\))?\s*/, // :pseudo
  group: /^\s*([\ \-><~,\+])\s*/, // #id, .class, tag...
}

const queryHandler = {
  singleGetter(a) {
    let v = document[a._get](a._key)
    a._list = v ? [v] : []
  },
  allTagFilter(a) {
    a._list = []
    for (let i = 0, f = a._context, l = f.length; i < l; i++) {
      for (let j = 0, s = f[i].getElementsByTagName('*'), t = s.length; j < t; j++) {
        queryFilter[a._type](a, s[j]) && a._list.push(s[j])
      }
    }
  },
  nativeFilter(a) {
    a._list = []
    for (let i = 0, f = a._context, l = f.length; i < l; i++) {
      for (let j = 0, s = f[i][a._get](a._key), t = s.length; j < t; j++) {
        queryFilter[a._type](a, s[j]) && a._list.push(s[j])
      }
    }
  },
  nativeGetter(a) {
    a._list = []
    for (let i = 0, f = a._context, l = f.length; i < l; i++) {
      for (let j = 0, s = f[i][a._get](a._key), t = s.length; j < t; j++) {
        a._list.push(s[j])
      }
    }
  },
}

const queryBefore = {
  id(a) {
    if (a._key.indexOf('#') == -1) {
      a._get = 'getElementById'
    } else {
      error('id operator "' + a._expr + '" unreasonable')
    }
  },
  class(a) {
    a._get = 'getElementsByClassName'
    if (a._key.indexOf('.') != -1) {
      let s = a._key.split('.')
      a._key = s.shift()
      if (s.length) {
        // if class.class... then change find "classes"
        a._type = 'classes'
        a._keys = s
      }
    }
  },
  tag(a) {
    a._get = 'getElementsByTagName'
  },
  attr(a) {
    if (a._expr) {
      a._expr += '='
      Operator[a._expr] || error('Attribute operator "' + a._expr + '" unreasonable')
    } else {
      a._expr = '!='
      a._value = null
    }
  },
  pseudo(a) {
    pseudoFinder[a._key] || error('Pseudo selector E:' + a._key + ' unreasonable')
    let h = pseudoBefore[a._key]
    return !h || h(a)
  },
  group(a) {
    a._started && error('Combinator selector unreasonable') // also "> E"
    groupFinder[a._key] || error('Combinator selector E ' + a._key + ' F unreasonable')
    if (a._key === ',') {
      a._filter = 0 // pre reset
    }
  },
}

const queryFilter = {
  id(a, b) {
    return b.id && b.id === a._key
  },
  class(a, b) {
    return b.className && b.className.split(/\s+| /).indexOf(a._key) != -1
  },
  classes(a, b) {
    return b.className && hasSome(b.className.split(/\s+| /), a._keys)
  },
  tag(a, b) {
    return b.nodeName && b.nodeName.toLowerCase() === a._key.toLowerCase()
  },
  attr(a, b) {
    let v = b.getAttribute(a._key)
    return v && Operator[a._expr](v, a._value)
  },
  pseudo(a, b) {
    return pseudoFinder[a._key](a, b)
  },
  group() {},
}

const queryFinder = {
  id: queryHandler.singleGetter,
  class: document.getElementsByClassName ? queryHandler.nativeGetter : queryHandler.allTagFilter,
  classes: document.getElementsByClassName ? queryHandler.nativeFilter : queryHandler.allTagFilter,
  tag: queryHandler.nativeGetter,
  attr: queryHandler.allTagFilter,
  pseudo: queryHandler.allTagFilter,
  group(a) {
    if (a._key === ',') {
      a.group()
    } else {
      a._list = []
      for (let i = 0, c = groupFinder[a._key], f = a._context, l = f.length; i < l; i++) {
        let e = f[i][c.start],
          n = 0
        while (e) {
          if (e.nodeType === 1) {
            a._list.push(e)
            if (++n === c.index) {
              break
            }
          }
          e = e[c.every]
        }
      }
    }
  },
}

const pseudoHandler = {
  nthChildFilter(a, b) {
    let p = b[a._parent]
    if (p) {
      for (let i = 0, l = p[a._start]; l; l = l[a._every]) {
        if (l.nodeType === 1 && ++i && b === l) {
          i -= a._last
          return i === a._first || (i % a._first === 0 && i / a._first >= 0)
        }
      }
    }
    return false
  },
  nthOfTypeFilter(a, b) {
    let p = b[a._parent]
    if (p) {
      for (let g = {}, l = p[a._start]; l; l = l[a._every]) {
        if (l.nodeType === 1) {
          let t = l.nodeName
          g[t] ? g[t]++ : (g[t] = 1)
          if (b === l) {
            g[t] -= a._last
            return g[t] === a._first || (g[t] % a._first === 0 && g[t] / a._first >= 0)
          }
        }
      }
    }
    return false
  },
  nthExprParser(a) {
    let p = /\+?(\-?\d*n?)\+?(\-?\d*n?)/.exec(a._expr) // 2n, 2n+1, -1+n
    ;(p && p[1]) || error('Pseudo selector E:' + a._key + '(' + a._expr + ') unreasonable')
    if (p[1] === 'n') {
      // nth-child(n)
    } else if (p[1] === '2n' || p[1] === 'even') {
      // nth-child(2n) or nth-child(even)
      a._first = 2
      a._last = 0
    } else if (p[1] === '2n+1' || p[1] === 'odd') {
      // nth-child(2n+1) or nth-child(odd)
      a._first = 2
      a._last = 1
    } else if (p[1].indexOf('n') != -1) {
      a._first = parseInt(p[1], 10) || 0
      a._last = parseInt(p[2], 10) || 0
    } else {
      a._last = parseInt(p[1], 10) || 0
      a._first = 0
    }
  },
  nthExprStatic(a) {
    a._expr && error('Pseudo selector E:' + a._key + ' no expression')
    a._first = 0
    a._last = 1
    a._parent = 'parentNode'
    a._start = 'firstChild'
    a._every = 'nextSibling'
  },
  nthLastExprStatic(a) {
    a._expr && error('Pseudo selector E:' + a._key + ' no expression')
    a._first = 0
    a._last = 1
    a._parent = 'parentNode'
    a._start = 'lastChild'
    a._every = 'previousSibling'
  },
  nthExprDynamic(a) {
    pseudoHandler.nthExprParser(a)
    a._parent = 'parentNode'
    a._start = 'firstChild'
    a._every = 'nextSibling'
  },
  nthLastExprDynamic(a) {
    pseudoHandler.nthExprParser(a)
    a._parent = 'parentNode'
    a._start = 'lastChild'
    a._every = 'previousSibling'
  },
}

const pseudoBefore = {
  'nth-child': pseudoHandler.nthExprDynamic,
  'nth-last-child': pseudoHandler.nthLastExprDynamic,
  'first-child': pseudoHandler.nthExprStatic,
  'last-child': pseudoHandler.nthLastExprStatic,
  'nth-of-type': pseudoHandler.nthExprDynamic,
  'nth-last-of-type': pseudoHandler.nthLastExprDynamic,
  'first-of-type': pseudoHandler.nthExprStatic,
  'last-of-type': pseudoHandler.nthLastExprStatic,
  root() {
    error('Pseudo selector E:root unreasonable, via document.documentDocument')
  },
  even(a) {
    a._expr && error('Pseudo selector E:' + a._key + ' no expression')
    a._first = 2
    a._last = 0
    a._parent = 'parentNode'
    a._start = 'firstChild'
    a._every = 'nextSibling'
  },
  odd(a) {
    a._expr && error('Pseudo selector E:' + a._key + ' no expression')
    a._first = 2
    a._last = 1
    a._parent = 'parentNode'
    a._start = 'firstChild'
    a._every = 'nextSibling'
  },
}

const pseudoFinder = {
  // E:root an E element, root of the document
  root() {
    error('Pseudo selector E:root unreasonable, via document.documentDocument')
  },
  // E:nth-child(even) an E element, the n-th child of its parent
  even: pseudoHandler.nthChildFilter,
  // E:nth-child(odd) an E element, the n-th child of its parent
  odd: pseudoHandler.nthChildFilter,
  // E:nth-child(n) an E element, the n-th child of its parent
  'nth-child': pseudoHandler.nthChildFilter,
  // E:nth-last-child(n) an E element, the n-th child of its parent, counting from the last one
  'nth-last-child': pseudoHandler.nthChildFilter,
  // E:first-child an E element, first child of its parent
  'first-child': pseudoHandler.nthChildFilter,
  // E:last-child an E element, last child of its parent
  'last-child': pseudoHandler.nthChildFilter,
  // E:only-child an E element, only child of its parent
  'only-child'(a, b) {
    return pseudoFinder['first-child'](a, b) && pseudoFinder['last-child'](a, b)
  },
  // E:nth-of-type(n) an E element, the n-th sibling of its type
  'nth-of-type': pseudoHandler.nthOfTypeFilter,
  // E:nth-last-of-type(n) an E element, the n-th sibling of its type, counting from the last one
  'nth-last-of-type': pseudoHandler.nthOfTypeFilter,
  // E:first-of-type an E element, first sibling of its type
  'first-of-type': pseudoHandler.nthOfTypeFilter,
  // E:last-of-type an E element, last sibling of its type
  'last-of-type': pseudoHandler.nthOfTypeFilter,
  // E:only-of-type an E element, only sibling of its type
  'only-of-type'(a, b) {
    return pseudoFinder['first-of-type'](a, b) && pseudoFinder['last-of-type'](a, b)
  },
  // E:empty an E element that has no children (including text nodes)
  empty(a, b) {
    // default 62, also 2^[1-5]
    for (let p = a._expr || 62, e = b.firstChild; e; e = e.nextSibling) {
      if (p & Math.pow(2, e.nodeType)) {
        return false
      }
    }
    return true
  },
  // E:target an E element being the target of the referring URI
  target(a, b) {
    let i = b.getAttribute('id')
    return i && b.nodeName.toLowerCase() === 'a' && i === location.href.split('#').pop()
  },
  // E:lang(fr) an element of type E in language "fr" (the document language specifies how language is determined)
  lang(a, b) {
    return b.lang === a._expr
  },
  // E:enabled
  enabled(a, b) {
    return b.disabled === false
  },
  // E:disabled a user interface element E which is enabled or disabled
  disabled(a, b) {
    return b.disabled === true
  },
  // E:checked a user interface element E which is checked (for instance a radio-button or checkbox)
  checked(a, b) {
    return b.nodeName.toLowerCase() === 'input' && ['checkbox', 'radio'].includes(b.type) && !!b.checked
  },
  // E:selected a user interface element E which is selected (for instance a select)
  selected(a, b) {
    b.parentNode.selectedIndex
    return b.selected === true
  },
  // E:valid a user interface element E which is valid (for instance a input, select, textarea)
  valid(a, b) {
    return b.name && !b.disabled && b.type && !['submit', 'reset', 'button', 'image', 'file'].includes(b.type)
  },
}

const groupFinder = {
  // E F an F element descendant of an E element
  //		" ": null,
  // E, F an F or E element appearing simultaneously
  // combinator
  ',': true, // E - F an F element immediately preceded by an E element
  // prev one, querySelectorAll invalid
  '-': { start: 'previousSibling', every: 'previousSibling', index: 1 },
  // E > F an F element parentNode of an E element
  // parent all, querySelectorAll invalid
  '<': { start: 'parentNode', every: 'parentNode', index: -1 },
  // E > F an F element child of an E element
  // child all
  '>': { start: 'firstChild', every: 'nextSibling', index: -1 },
  // E + F an F element immediately preceded by an E element
  // next one
  '+': { start: 'nextSibling', every: 'nextSibling', index: 1 },
  // E ~ F an F element preceded by an E element
  // next all
  '~': { start: 'nextSibling', every: 'nextSibling', index: -1 },
}

function error(e) {
  console.warn(NAME + VERSION + ': ' + e)
  throw new Error(NAME + VERSION + ': ' + e)
}

function hasSome(a, b) {
  for (let i = 0, l = b.length; i < l; i++) {
    if (a.indexOf(b[i]) != -1) {
      return true
    }
  }
  return false
}

/**
 * Specify selector type find
 *
 * @param {String} a selector
 * @param {Document|Element} b context
 * @param {String} c selector type
 * @param {Boolean} d use native, if exists
 */
function faster(a, b, c, d) {
  typeof a === 'string' || error('Selector unreasonable')
  let q = new Query(a, b)
  if (!d && q.hasQsa()) {
    return q.execQsa(a)
  }
  q.start(c)
  return q.execute()
}

function find(a, b, c) {
  typeof a === 'string' || error('Selector unreasonable')
  let q = new Query(a, b)
  if (!c && q.hasQsa()) {
    return q.execQsa(a)
  }
  // debugger
  while (q.next()) {
    for (let t in queryMatcher) {
      if (!q.start(t)) {
        continue
      }
      if (!q.before()) {
        break
      }
      q.find()
      console.log(t, { ...q })
      if (!q.next()) {
        break
      }
      q.end()
    }
    if (q.noop()) {
      break
    }
  }
  return q.reback()
}

function filter(a, b) {
  if (typeof a !== 'string') {
    return b
  }
  let q = new Query(a, b)
  while (q.next()) {
    for (let t in queryMatcher) {
      if (!q.start(t)) {
        continue
      }
      if (!q.before()) {
        break
      }
      q.filter()
      if (!q.next()) {
        break
      }
      q.end()
    }
    if (q.noop()) {
      break
    }
  }
  return q.reback()
}

function $(a, b, c) {
  if (!a) {
    return null
  }
  if (typeof a === 'string') {
    // String, CSS Selector
    return find(a, b, c)
  }
  if (typeof a === 'function') {
    // Function
    return $(a(), b, c)
  }
  if (a.nodeType === 1) {
    // Element, in parent
    return !b || !b.length || $(b, null, true).some((e) => e.compareDocumentPosition(a) === 10) ? a : []
  }
  if (a.nodeType === 9 || a.setTimeout) {
    // Window or Document
    return document.body
  }
  if (typeof a.splice === 'function' && typeof a.length === 'number') {
    // ArrayLike, when window has length attr
    return a
  }
  return []
}

function $id(a, b, c) {
  return faster(a, b, 'id', c)
}

function $tag(a, b, c) {
  return faster(a, b, 'tag', c)
}

function $name(a, b, c) {
  return faster(a, b, 'name', c)
}

function $class(a, b, c) {
  return faster(a, b, 'class', c)
}

export { faster, find, filter, $, $id, $tag, $name, $class }
