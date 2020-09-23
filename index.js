/**
 * Simple Css Selector (轻量级 CssSelector)
 *
 *  1. match selector
 *  2. prefilter type, return false then direct reback
 *  3. find type, contains filter
 *  4. reback
 *
 * @see     http://www.w3.org/TR/selectors/
 * @author  Yonglong Zhu<733433@qq.com>
 * @version 1.0.2
 */

/**
 * 选择器执行过程控制类
 * @param {String} a 选择器
 * @param {Element} b 父元素
 */
function Query(a, b) {
  b = b ? $(b, null, true) : [document]
  this._selector = a
  this._operator = a
  this._count = 0 // query count
  this._originalContext = b
  this.init(b)
}

Query.prototype = {
  /**
   * 变量初始化
   * @param {String} a 选择器
   */
  init(a) {
    this._context = a // 选择器父元素
    this._started = true // 是否开始切换选择器
    this._updated = false // 是否将_context更新为当前查询结果
    this._filter = 0 // 是否开始过滤当前查询结果, 0:不过滤; >1:过滤
    this._type = null // 选择器类型, 即queryMatcher中的key
    this._key = null // 单段选择器，比如：#id, .class, tag; attr: name; pseudo: >, ~, +
    this._expr = null // 选择器中逻辑操作符，比如：=, ^=, $=, *=, |=, !=, pseudo: (args)
    this._value = null // 选择器中逻辑操作值
    this._group = null // 当前组合查询结果
    this._list = null // 当前单组查询结果
    this._first = null // 元素收集算法起始定位
    this._last = null // 元素收集算法末尾定位
  },
  /**
   * 查询执行前并返回是否继续处理
   * @returns {Boolean}
   */
  before() {
    return queryBefore[this._type](this) !== false
  },
  /**
   * 执行查询方法
   */
  find() {
    this._filter > 1 ? this.filter() : queryFinder[this._type](this)
  },
  /**
   * 执行过滤方法
   */
  filter() {
    this._list = this._list.filter((v) => queryFilter[this._type](this, v))
  },
  /**
   * 执行中
   * @returns {Array}
   */
  execute() {
    this.before() && this.find()
    return this.reback()
  },
  /**
   * 执行开始并返回是否需要继续处理
   * @returns {Boolean}
   */
  start(a) {
    let m = this._operator.match(queryMatcher[a])
    if (!m || !m[0]) {
      return false
    }
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
  /**
   * 分组查询
   */
  group() {
    let r = this._list
    this.init(this._originalContext)
    this._group = (this._group || []).concat(r)
  },
  /**
   * 查询结束
   */
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
  /**
   * 是否已处理完
   * @returns {Boolean}
   */
  next() {
    return !!this._operator
  },
  /**
   * 是否结束查询
   * @returns {Boolean}
   */
  noop() {
    return !this._count || this._count > 100
  },
  /**
   * 返回最终查询结果
   * @returns {Array}
   */
  reback() {
    return this._group ? Array.from(new Set(this._group.concat(this._list))) : this._list
  },
  /**
   * 是否有原生选择器
   * @returns {Boolean}
   */
  hasQsa() {
    return !!this._context[0].querySelectorAll
  },
  /**
   * 执行原生选择器
   * @returns {Boolean}
   */
  execQsa(a) {
    for (var i = 0, r = [], f = this._context, l = f.length; i < l; i++) {
      r = r.concat(Array.slice(f[i].querySelectorAll(a) || []))
    }
    return r
  },
}

// 封装逻辑操作符号对应的处理方法
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
  // 相等，实际判断全等
  '=='(a, b) {
    return a === b
  },
  // 不相等，实际判断不全等
  '!='(a, b) {
    return a !== b
  },
  // 相等 或 a包含b
  '*='(a, b) {
    return Operator['==']() || a.has(b)
  },
  // 相等 或 a包含“ b” 或 a包含“b ”
  '~='(a, b) {
    return Operator['==']() || a.has(' ' + b) || a.has(b + ' ')
  },
  // 相等 或 a从首位开始包含b
  '^='(a, b) {
    return Operator['==']() || a.substr(0, b.length) === b
  },
  // 相等 或 a从末位开始包含b
  '$='(a, b) {
    return Operator['==']() || a.substr(a.length - b.length) === b
  },
  // 相等 或 a从首位开始包含“b-”
  '|='(a, b) {
    return Operator['==']() || a.substr(0, b.length + 1) === b + '-'
  },
}

// 选择器类型对应的正则表达式
const queryMatcher = {
  id: /^\s*#([#\w\-]*)\s*/, // #id
  class: /^\s*\.([\.\w_]+[\w\-_]*)\s*/, // .class
  tag: /^\s*([\w_]+[\w\-_]*|\*)\s*/, // tag
  attr: /^\s*\[(@?[\w_]+[\w\-_]*)([~\^$*\|!=]?)=?([^\]]*?)\]\s*/, // [attr=val]
  pseudo: /^\s*:(\w+[\w\-_]*)(?:\(([\w\s\-\+]+)\))?\s*/, // :pseudo
  group: /^\s*([\ \-><~,\+])\s*/, // #id, .class, tag...
}

// 封装查询不同类型选择器的方法
const queryHandler = {
  /**
   * 收集查询单个结果集
   * @param {Query} a
   */
  singleGetter(a) {
    let v = document[a._get](a._key)
    a._list = v ? [v] : []
  },
  /**
   * 收集查询所有标签过滤后的结果集
   * @param {Query} a
   */
  allTagFilter(a) {
    a._list = []
    for (let i = 0, f = a._context, l = f.length; i < l; i++) {
      for (let j = 0, s = f[i].getElementsByTagName('*'), t = s.length; j < t; j++) {
        queryFilter[a._type](a, s[j]) && a._list.push(s[j])
      }
    }
  },
  /**
   * 收集自定义原生查询方法过滤后的结果集
   * @param {Query} a
   */
  nativeFilter(a) {
    a._list = []
    for (let i = 0, f = a._context, l = f.length; i < l; i++) {
      for (let j = 0, s = f[i][a._get](a._key), t = s.length; j < t; j++) {
        queryFilter[a._type](a, s[j]) && a._list.push(s[j])
      }
    }
  },
  /**
   * 收集自定义原生查询方法的结果集
   * @param {Query} a
   */
  nativeGetter(a) {
    a._list = []
    for (let i = 0, f = a._context, l = f.length; i < l; i++) {
      for (let j = 0, s = f[i][a._get](a._key), t = s.length; j < t; j++) {
        a._list.push(s[j])
      }
    }
  },
}

// 封装了设置查询前的配置方法
const queryBefore = {
  /**
   * 查询id前的配置方法
   * @param {Query} a
   */
  id(a) {
    if (a._key.indexOf('#') == -1) {
      a._get = 'getElementById'
    } else {
      error('id operator "' + a._expr + '" unreasonable')
    }
  },
  /**
   * 查询class前的配置方法
   * @param {Query} a
   */
  class(a) {
    a._get = 'getElementsByClassName'
    if (a._key.indexOf('.') != -1) {
      let s = a._key.split('.')
      a._key = s.shift()
      // 如果是多个class相连时type设置成classes
      if (s.length) {
        a._type = 'classes'
        a._keys = s
      }
    }
  },
  /**
   * 查询tag前的配置方法
   * @param {Query} a
   */
  tag(a) {
    a._get = 'getElementsByTagName'
  },
  /**
   * 查询attr前的配置方法
   * @param {Query} a
   */
  attr(a) {
    if (a._expr) {
      a._expr += '='
      Operator[a._expr] || error('Attribute operator "' + a._expr + '" unreasonable')
    } else {
      a._expr = '!='
      a._value = null
    }
  },
  /**
   * 查询伪类前的配置方法
   * @param {Query} a
   */
  pseudo(a) {
    pseudoFinder[a._key] || error('Pseudo selector E:' + a._key + ' unreasonable')
    let h = pseudoBefore[a._key]
    return !h || h(a)
  },
  /**
   * 分组查询前的配置方法
   * @param {Query} a
   */
  group(a) {
    a._started && error('Combinator selector unreasonable') // also "> E"
    groupFinder[a._key] || error('Combinator selector E ' + a._key + ' F unreasonable')
    if (a._key === ',') {
      a._filter = 0 // pre reset
    }
  },
}

// 封装了查询时过滤选择器的方法
const queryFilter = {
  /**
   * 过滤id的方法
   * @param {Query} a
   * @param {Element} b
   */
  id(a, b) {
    return b.id && b.id === a._key
  },
  /**
   * 过滤class的方法
   * @param {Query} a
   * @param {Element} b
   */
  class(a, b) {
    return b.className && b.className.split(/\s+| /).indexOf(a._key) != -1
  },
  /**
   * 过滤多个class相连的方法
   * @param {Query} a
   * @param {Element} b
   */
  classes(a, b) {
    return b.className && hasSome(b.className.split(/\s+| /), a._keys)
  },
  /**
   * 过滤tag的方法
   * @param {Query} a
   * @param {Element} b
   */
  tag(a, b) {
    return b.nodeName && b.nodeName.toLowerCase() === a._key.toLowerCase()
  },
  /**
   * 过滤attr的方法
   * @param {Query} a
   * @param {Element} b
   */
  attr(a, b) {
    let v = b.getAttribute(a._key)
    return v && Operator[a._expr](v, a._value)
  },
  /**
   * 过滤伪类的方法
   * @param {Query} a
   * @param {Element} b
   */
  pseudo(a, b) {
    return pseudoFinder[a._key](a, b)
  },
  /**
   * 过滤分组的方法
   * @param {Query} a
   * @param {Element} b
   */
  group(a, b) {
    // noop
  },
}

// 封装了查询选择器的方法
const queryFinder = {
  // id查询器
  id: queryHandler.singleGetter,
  // class查询器
  class: document.getElementsByClassName ? queryHandler.nativeGetter : queryHandler.allTagFilter,
  // 多class相连查询器
  classes: document.getElementsByClassName ? queryHandler.nativeFilter : queryHandler.allTagFilter,
  // tag查询器
  tag: queryHandler.nativeGetter,
  // attr查询器
  attr: queryHandler.allTagFilter,
  // 伪类查询器
  pseudo: queryHandler.allTagFilter,
  /**
   * 分组查询器
   * @param {Query} a
   */
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

// 封装了伪类过滤器的方法
const pseudoHandler = {
  /**
   * nth-child伪类过滤算法
   * @param {Query} a
   * @param {Element} b
   * @returns {Boolean}
   */
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
  /**
   * nth-child伪类过滤算法
   * @param {Query} a
   * @param {Element} b
   */
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
  /**
   * nth-child伪类解析器
   * @param {Query} a
   */
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
  /**
   * first-child伪类配置
   * @param {Query} a
   */
  firstExprSetting(a) {
    a._expr && error('Pseudo selector E:' + a._key + ' no expression')
    a._first = 0
    a._last = 1
    a._parent = 'parentNode'
    a._start = 'firstChild'
    a._every = 'nextSibling'
  },
  /**
   * last-child伪类配置
   * @param {Query} a
   */
  lastExprSetting(a) {
    a._expr && error('Pseudo selector E:' + a._key + ' no expression')
    a._first = 0
    a._last = 1
    a._parent = 'parentNode'
    a._start = 'lastChild'
    a._every = 'previousSibling'
  },
  /**
   * nth-child伪类配置
   * @param {Query} a
   */
  nthExprSetting(a) {
    pseudoHandler.nthExprParser(a)
    a._parent = 'parentNode'
    a._start = 'firstChild'
    a._every = 'nextSibling'
  },
  /**
   * nth-last-child伪类配置
   * @param {Query} a
   */
  nthLastExprSetting(a) {
    pseudoHandler.nthExprParser(a)
    a._parent = 'parentNode'
    a._start = 'lastChild'
    a._every = 'previousSibling'
  },
}

// 封装了伪类查询前的方法
const pseudoBefore = {
  'nth-child': pseudoHandler.nthExprSetting,
  'nth-last-child': pseudoHandler.nthLastExprSetting,
  'first-child': pseudoHandler.firstExprSetting,
  'last-child': pseudoHandler.lastExprSetting,
  'nth-of-type': pseudoHandler.nthExprSetting,
  'nth-last-of-type': pseudoHandler.nthLastExprSetting,
  'first-of-type': pseudoHandler.firstExprSetting,
  'last-of-type': pseudoHandler.lastExprSetting,
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

// 封装了伪类查询方法, 大部分注释及算法均来自w3c官方
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

// 封装了分组查询的方法
const groupFinder = {
  // E F an F element descendant of an E element
  // " ": null,
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

/**
 * 抛出错误异常
 * @param {String} e
 */
function error(e) {
  console.warn(NAME + VERSION + ': ' + e)
  throw new Error(NAME + VERSION + ': ' + e)
}

/**
 * 数组相同键对应的值是否具有包含关系
 * @param {Array} a
 * @param {Array} b
 * @returns {Boolean}
 */
function hasSome(a, b) {
  for (let i = 0, l = b.length; i < l; i++) {
    if (a.includes(b[i])) {
      return true
    }
  }
  return false
}

/**
 * 指定类型查询
 * @param {String} a selector
 * @param {Document|Element} b context
 * @param {String} c selector type
 * @param {Boolean} d use native, if exists
 * @returns {Array}
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

/**
 * 不指定类型查询
 * @param {String} a
 * @param {Element} b
 * @param {Boolean} c
 * @returns {Array}
 */
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
      // console.log(t, { ...q })
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

/**
 * 不指定类型过滤
 * @param {String} a
 * @param {Element} b
 * @returns {Array}
 */
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

/**
 * 综合查询
 * @param {String} a
 * @param {Element} b
 * @param {Boolean} c
 * @returns {Array}
 */
function $(a, b, c) {
  if (!a) {
    return null
  }
  // String, CSS Selector
  if (typeof a === 'string') {
    return find(a, b, c)
  }
  // Function
  if (typeof a === 'function') {
    return $(a(), b, c)
  }
  // Element, in parent
  if (a.nodeType === 1) {
    return !b || !b.length || $(b, null, true).some((e) => e.compareDocumentPosition(a) === 10) ? a : []
  }
  // Window or Document
  if (a.nodeType === 9 || a.setTimeout) {
    return document.body
  }
  // ArrayLike, when window has length attr
  if (typeof a.splice === 'function' && typeof a.length === 'number') {
    return a
  }
  return []
}

/**
 * 根据ID查询
 * @param {String} a
 * @param {Element} b
 * @param {Boolean} c
 * @returns {Element}
 */
function $id(a, b, c) {
  return faster(a, b, 'id', c)
}

/**
 * 根据ID查询
 * @param {String} a
 * @param {Element} b
 * @param {Array} c
 * @returns {Element}
 */
function $tag(a, b, c) {
  return faster(a, b, 'tag', c)
}

/**
 * 根据ID查询
 * @param {String} a
 * @param {Element} b
 * @param {Boolean} c
 * @returns {Array}
 */
function $name(a, b, c) {
  return faster(a, b, 'name', c)
}

/**
 * 根据className查询
 * @param {String} a
 * @param {Element} b
 * @param {Boolean} c
 * @returns {Array}
 */
function $class(a, b, c) {
  return faster(a, b, 'class', c)
}

export { faster, find, filter, $, $id, $tag, $name, $class }
