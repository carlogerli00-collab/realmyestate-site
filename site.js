// What the published page does beyond the Atelier's design (added by build.mjs, not part of the Atelier screens):
// the calendar card shows Danilo's real free times from Calendly, the two forms really send, and visits are counted
// without cookies or stored identifiers. Server: online/api (Cloudflare Worker).
(function () {
  'use strict'
  var API = 'https://realmyestate-api.carlogerli00.workers.dev'
  var CALENDLY = 'https://calendly.com/bookingmyhotel/meeting-con-danilo-molaschi'
  var MAIL = 'marketing@bookingmyhotel.it'
  var TZ = 'Europe/Rome'
  var screenKind = /\/d\//.test(location.pathname) ? 'desktop' : 'phone'
  var visit = Math.random().toString(36).slice(2, 12) // lives only in this page's memory

  // ---- visits and clicks -------------------------------------------------------------------------------------------
  function track(ev) {
    try {
      var q = new URLSearchParams(location.search)
      var body = JSON.stringify({ ev: ev, path: location.pathname, ref: ev === 'view' ? document.referrer : '', us: q.get('utm_source') || '', um: q.get('utm_medium') || '', uc: q.get('utm_campaign') || '', screen: screenKind, v: visit })
      var blob = new Blob([body], { type: 'text/plain' })
      if (!(navigator.sendBeacon && navigator.sendBeacon(API + '/hit', blob))) fetch(API + '/hit', { method: 'POST', body: body, keepalive: true }).catch(function () {})
    } catch (e) {}
  }
  // links to other sites (LinkedIn, Calendly) open in a new tab, so the page stays where the visitor left it
  // (26 Nov 2026, Danilo: «Meglio se apre una nuova scheda»)
  function externalLinks() {
    document.querySelectorAll('a[href^="http"]').forEach(function (a) {
      if (a.hostname && a.hostname !== location.hostname) { a.target = '_blank'; a.rel = 'noopener' }
    })
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]')
    if (!a) return
    var h = a.getAttribute('href') || ''
    if (h.indexOf('calendly.com') >= 0) track('book')
    else if (h.indexOf('tel:') === 0) track('call')
    else if (h.indexOf('mailto:') === 0) track(/network|investitor/i.test(h) ? 'investor' : 'email')
    else if (h.indexOf('linkedin.com') >= 0) track('linkedin')
  }, true)

  // ---- the calendar card ---------------------------------------------------------------------------------------------
  var fmt = function (opts) { return new Intl.DateTimeFormat('it-IT', Object.assign({ timeZone: TZ }, opts)) }
  var fDay = fmt({ year: 'numeric', month: '2-digit', day: '2-digit' })
  var fWd = fmt({ weekday: 'short' }), fNum = fmt({ day: 'numeric' }), fMonth = fmt({ month: 'long', year: 'numeric' })
  var fLong = fmt({ weekday: 'long', day: 'numeric', month: 'long' }), fTime = fmt({ hour: '2-digit', minute: '2-digit' })
  var cap = function (s) { return s.charAt(0).toUpperCase() + s.slice(1) }

  function setupCalendar(cal, slots) {
    var btn = cal.parentNode.querySelector('a.btn[href*="calendly.com"]')
    var days = [], byDay = {}
    slots.forEach(function (s) {
      var d = new Date(s.t), k = fDay.format(d)
      if (!byDay[k]) { byDay[k] = []; days.push({ key: k, date: d }) }
      byDay[k].push({ date: d, url: s.url })
    })
    var dayList = cal.querySelector('.days'), slotList = cal.querySelector('.slots'), sum = cal.querySelector('.sum'), mo = cal.querySelector('.mo')
    var nav = mo && mo.querySelector('.nav'), arrows = nav ? nav.querySelectorAll('.i') : []
    var page = 0, dayIdx = 0, slotIdx = 0
    cal.setAttribute('role', 'group')

    function pickSlots(list) {
      // four times spread over the day (morning to afternoon); Calendly shows them all after «Conferma»
      if (list.length <= 4) return list
      var out = [], seen = {}
      for (var i = 0; i < 4; i++) { var j = Math.round(i * (list.length - 1) / 3); if (!seen[j]) { seen[j] = 1; out.push(list[j]) } }
      return out
    }
    function li(html, on, fn, label) {
      var el = document.createElement('li')
      el.innerHTML = html
      if (on) el.className = 'on'
      el.tabIndex = 0
      el.setAttribute('role', 'button')
      el.setAttribute('aria-pressed', on ? 'true' : 'false')
      if (label) el.setAttribute('aria-label', label)
      el.style.cursor = 'pointer'
      el.addEventListener('click', fn)
      el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn() } })
      return el
    }
    function render() {
      var first = page * 5, shown = days.slice(first, first + 5), d = days[dayIdx], times = pickSlots(byDay[d.key]), t = times[slotIdx] || times[0]
      if (mo) { mo.firstChild && mo.firstChild.nodeType === 3 ? (mo.firstChild.nodeValue = cap(fMonth.format(d.date))) : mo.insertBefore(document.createTextNode(cap(fMonth.format(d.date))), mo.firstChild) }
      dayList.innerHTML = ''
      shown.forEach(function (x, i) {
        var idx = first + i
        dayList.appendChild(li('<small>' + fWd.format(x.date).replace('.', '') + '</small>' + fNum.format(x.date), idx === dayIdx, function () { dayIdx = idx; slotIdx = 0; render(); track('slot') }, cap(fLong.format(x.date))))
      })
      slotList.innerHTML = ''
      times.forEach(function (s, i) {
        slotList.appendChild(li(fTime.format(s.date), s === t, function () { slotIdx = i; render(); track('slot') }))
      })
      var when = cap(fLong.format(t.date)) + ', ore ' + fTime.format(t.date)
      sum.textContent = when
      cal.setAttribute('aria-label', 'Il calendario di Danilo Molaschi: colloquio di 30 minuti in videochiamata. Scelto ' + when + '.')
      if (btn) btn.href = t.url
      if (arrows.length === 2) {
        arrows[0].style.opacity = page > 0 ? '1' : '.32'
        arrows[1].style.opacity = (page + 1) * 5 < days.length ? '1' : '.32'
      }
    }
    if (arrows.length === 2) {
      ;[[arrows[0], -1], [arrows[1], 1]].forEach(function (p) {
        p[0].style.cursor = 'pointer'
        p[0].setAttribute('role', 'button')
        p[0].setAttribute('aria-label', p[1] < 0 ? 'Giorni precedenti' : 'Giorni successivi')
        p[0].addEventListener('click', function () {
          var np = page + p[1]
          if (np < 0 || np * 5 >= days.length) return
          page = np; dayIdx = np * 5; slotIdx = 0; render()
        })
      })
    }
    render()
  }

  function calendarFallback(cal) {
    // no free times to show (Calendly unreachable or fully booked): no invented date, «Conferma» opens Calendly itself
    cal.querySelectorAll('.days, .slots').forEach(function (el) { el.style.display = 'none' })
    var sum = cal.querySelector('.sum')
    if (sum) sum.textContent = 'Scegli il giorno e l’ora che preferisci.'
    var mo = cal.querySelector('.mo')
    if (mo && mo.firstChild && mo.firstChild.nodeType === 3) mo.firstChild.nodeValue = ''
    var btn = cal.parentNode.querySelector('a.btn[href*="calendly.com"]')
    if (btn) btn.href = CALENDLY
    cal.setAttribute('aria-label', 'Il calendario di Danilo Molaschi: colloquio di 30 minuti in videochiamata.')
  }

  function loadCalendar() {
    var cal = document.querySelector('.cal')
    if (!cal) return
    fetch(API + '/slots').then(function (r) { return r.ok ? r.json() : Promise.reject(r.status) }).then(function (d) {
      if (d && d.slots && d.slots.length) setupCalendar(cal, d.slots)
      else calendarFallback(cal)
    }).catch(function () { calendarFallback(cal) })
  }

  // ---- the two forms ----------------------------------------------------------------------------------------------------
  function post(path, data) {
    return fetch(API + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j } }) })
  }
  function show(el, on) { if (el) el.hidden = !on }

  function setupMessage() {
    var box = document.getElementById('sent-form')
    if (!box) return
    var form = box.parentNode, send = form.querySelector('label[for="sent-form"]'), errs = form.querySelectorAll('.err')
    var val = function (n) { var el = form.querySelector('[name="' + n + '"]'); return el ? el.value.trim() : '' }
    var busy = false
    send.addEventListener('click', function (e) {
      e.preventDefault()
      if (busy) return
      show(errs[0], false); show(errs[1], false)
      var data = { nome: val('nome'), contatto: val('contatto'), albergo: val('albergo'), messaggio: val('messaggio'), page: screenKind }
      if (!data.contatto) { show(errs[0], true); return }
      busy = true
      send.style.opacity = '.6'
      post('/message', data).then(function (r) {
        if (!r.ok) throw new Error('send')
        if (r.j && r.j.mailed === false) {
          // no mail service yet: the visitor's own email opens with the message ready, so it reaches Danilo anyway
          var text = 'Nome: ' + data.nome + '\nContatto: ' + data.contatto + '\nAlbergo e località: ' + data.albergo + '\n\n' + data.messaggio
          location.href = 'mailto:' + MAIL + '?subject=' + encodeURIComponent('Messaggio dal sito RealMyEstate') + '&body=' + encodeURIComponent(text)
        }
        box.checked = true
        track('message')
      }).catch(function () { show(errs[1], true) }).then(function () { busy = false; send.style.opacity = '' })
    }, true)
  }

  // «Entra nel network»: the investor's email, sent to Danilo as a message (it was a mailto link, dead on a computer
  // without a mail program)
  function setupNetwork() {
    var box = document.getElementById('sent-net')
    if (!box) return
    var wrap = box.parentNode, send = wrap.querySelector('label[for="sent-net"]'), input = wrap.querySelector('input[type="email"]'), err = wrap.querySelector('.err')
    var busy = false
    var go = function (e) {
      if (e) e.preventDefault()
      if (busy) return
      show(err, false)
      var email = (input.value || '').trim()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { show(err, true); input.focus(); return }
      busy = true
      send.style.opacity = '.6'
      post('/message', { kind: 'network', nome: '', contatto: email, albergo: '', messaggio: 'Vuole entrare nel network degli investitori e ricevere le presentazioni riservate.', page: screenKind }).then(function (r) {
        if (!r.ok) throw new Error('network')
        box.checked = true
        track('investor')
      }).catch(function () { show(err, true) }).then(function () { busy = false; send.style.opacity = '' })
    }
    send.addEventListener('click', go, true)
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(e) })
  }

  function setupNews() {
    var box = document.getElementById('sent-news')
    if (!box) return
    var wrap = box.parentNode, send = wrap.querySelector('label[for="sent-news"]'), input = wrap.querySelector('input[type="email"]'), err = wrap.querySelector('.err')
    var busy = false
    var go = function (e) {
      if (e) e.preventDefault()
      if (busy) return
      show(err, false)
      var email = (input.value || '').trim()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { show(err, true); return }
      busy = true
      send.style.opacity = '.6'
      post('/news', { email: email, page: screenKind }).then(function (r) {
        if (!r.ok) throw new Error('news')
        box.checked = true
        track('news')
      }).catch(function () { show(err, true) }).then(function () { busy = false; send.style.opacity = '' })
    }
    send.addEventListener('click', go, true)
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(e) })
  }

  function start() {
    track('view')
    externalLinks()
    loadCalendar()
    setupMessage()
    setupNetwork()
    setupNews()
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start)
  else start()
})()
