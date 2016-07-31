// Helper functions


function either() {
  var args = Array.prototype.slice.call(arguments)
  for(var i = 0, ret = null; ret === null; i++) {
    if(!(typeof args[i] === 'undefined' || args[i] === null))
      ret = args[i]
  }
  return ret
}

function decodeHTMLEntities(str) {
  return str.replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>').replace('&quot;', '"')
}

// Functions


function getMessagesAsHTML(options, cb) {
  // Make a normal GET request to the proper messages URL as specified by options.
  //
  // Parameters: 
  //   Object options:
  //     String url: URL to make GET request to. Overrides all other properties. Defaults to URL decided by properties page and index.
  //     String page: Subpage after `'https://scratch.mit.edu/messages/'`. `'comments'` or `'alerts'` or `''`. Defaults to `''`.
  //     Number index: Page-index to get messages from, where index 0 has the newest messages. Defaults to `0`.
  //   Function cb:
  //   Parameters:
  //     Object error:
  //       String message
  //       Number status
  //       String statusText
  //       Function call: Function which throws the message property to the console when called.
  //     Array messages: Array where every element is an HTMLElement with tag `h3` (specifying date for messages below it, but for alerts this info is in the actual message instead) or `li` (actual messages).
  //
  // Returns: `undefined`
  
  var req = new XMLHttpRequest()
  var url = options.url || 'https://scratch.mit.edu/messages/' + (options.page ? options.page + '/' : '') + (options.index ? options.index.toString() : '0')
  req.open('GET', url)
  req.onreadystatechange = function() {
    if(req.readyState === req.DONE) {
      if(req.status === 200) {
        if(typeof cb === 'function') cb.call(req, undefined, (new DOMParser()).parseFromString(req.responseText, 'text/html').getElementById('notification-list').children[0].children)
      } else {
        cb.call(req, {
          message:    'GET request to ' + url + ' failed with status ' + req.status + ' ' + req.statusText,
          status:     req.status,
          statusText: req.statusText,
          call: function() {
            try {
              throw this.message
            } catch(err) {
              (console.error || console.log)(this.message)
            }
          }
        }, undefined)
      }
    }
  }  
  req.send()
}


function getMessages(options, cb) {
  // Gets a certain amount of messages from a certain offset of the logged in user.
  //
  // Parameters: 
  //   Object options:
  //     Number limit: How many messages to get back. Defaults to `20`.
  //     Number offset: The offset to get messages after. Defaults to `0`.
  //     Boolean commentsOnly: Whether or not to only get back comments. Defaults to `false`.
  //     Boolean alertsOnly: Whether ot not to only get back alerts. Lower priority than `options.commentsOnly`. Defaults to `false`.
  //     String page: The messages subpage, `'comments'` or `'alerts'` or `''`, to add to the messages URL. Lower priority than `commentsOnly` and `alertsOnly`. Defaults to `''`.
  //     Function filter: Called for every message, decides whether or not a message is to be included or not:
  //     Parameters:
  //       ScratchMessage message: the message to be (or not to be) filtered
  //     Number wait: How long to wait between individual HTTP requests, in milliseconds. Defaults to `4000`.
  //
  //   Function cb:
  //   Parameters:
  //     Object err: Error-object like the one described by `getMessagesAsHTML`.
  //     Array messages: Array where every element is instance of class `ScratchMessage`.
  //
  // Returns: `undefined`
  
  options.limit  = options.limit  || 20
  options.offset = options.offset || 0
  options.wait   = options.wait   || 4000
  
  if(options.commentsOnly)    options.page = 'comments'
  else if(options.alertsOnly) options.page = 'alerts'
  
  var messages = []
  var limit = options.offset + options.limit
  var offsetHere, msg
  var whileLoop = function(pushed, pageIndex, offset, cb) {

    getMessagesAsHTML({ page: options.page, index: pageIndex }, function(error, cbMessages) {
      if(error) cb(error)
      
      var amountToPush = options.limit
      var month = null, date = null, year = null
      var current, msg
      for(var y = 0; y < offset + amountToPush && y < cbMessages.length; y++) {
        current = cbMessages[y]
        
        if(current.tagName === 'H3') {
          var split = current.innerHTML.replace(',', '').split(' ')
          if(split.length === 1) {
            month = null, date = null, year = null
          } else {
            month = split[1], date = split[2], year = split[3]
          }
          if(y >= offset)
            amountToPush += 1
          else
            offset += 1
        } else {
          msg = new ScratchMessage(current, month, date, year)
          if(y >= offset) {
            if(typeof options.filter === 'function' ? options.filter(msg) : true) {
              messages.push(msg)
              pushed += 1
            } else {
              amountToPush += 1
            }
          }
        }
      }
      
      if(pushed < limit) {
        setTimeout(whileLoop.bind(this, pushed, pageIndex + 1, 0, cb), options.wait)
      } else {
        cb(undefined) 
      }
    })
  }
  
  whileLoop(0, 0, options.offset, function(error) {
    cb(error, messages)
  })
}


// Classes


ScratchDate.MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

function ScratchDate(month, date, year, hours, minutes, hasTime) {
  // ## ScratchDate
  // #### A system to generate a date-string like the ones in Alerts from some parameters.
  //
  // Parameters:
  //   String month: Defaults to the current month in the user's timezone.
  //   Number date: Defaults to the current date in the user's timezone (date here means the index of a day in a month, like the `27`th of July).
  //   Number year: Defaults to the current year in the user's timezone.
  //   Number hours: Defaults to the current hours in the user's timezone (goes from 1:00 to 24:59).
  //   Number minutes: Defaults to the current minutes in the user's timezone.
  //   Boolean hasTime: Whether or not to specify hours, minutes and time and whether to include it in the string value.
  // Instance properties:
  //   String month
  //   Number date
  //   Number year
  //   Number hours
  //   Number minutes
  //   String time: A string describing the hours and minutes, hours going from 1:00 to 12:59 w/ a.m. or p.m. present.
  //   String string: The actual `ScratchDate` string describing the date as it would be in an Alert message.

  if(hasTime === undefined || hasTime === null) hasTime = true
  this.hasTime = hasTime
  
  var dateObj = new Date()
  this.month = either(month, ScratchDate.MONTHS[dateObj.getMonth()])
  this.date = either(date, dateObj.getDate())
  this.year = either(year, dateObj.getFullYear())
  this.hours = hasTime ? either(hours, dateObj.getHours()) : undefined
  this.minutes = hasTime ? either(minutes, dateObj.getMinutes()) : undefined
  
  this.updateString()
}

ScratchDate.fromString = function(string) {
  // ## _static_ ScratchDate.fromString
  // #### Parses a `ScratchDate` string and returns an instance of ScratchDate for it
  // 
  // Parameters:
  //   String string
  
  var split = string.split(' ')
  var time = split[split.length - 2].substring(1)
  var hourOffset = split[split.length - 1] === 'p.m.' ? 12 : 0
  timeSplit = time.split(':')
  return new ScratchDate(split[0], split[1], split[2], Number(timeSplit[0]) + hourOffset, Number(timeSplit[1]))
}

ScratchDate.prototype.updateString = function() {
  // ## ScratchDate.updateString
  // #### Updates the time and string values of an instance based on it's other values. To be called on value changes.
  
  if(this.hasTime) this.time = (((this.hours - 1) % 12) + 1).toString() + ':' + this.minutes.toString() + (this.hours > 12 ? ' p.m.' : ' a.m.')
  this.string = (this.hasTime ? [this.month, this.date, this.year, '@' + this.time] : [this.month, this.date, this.year]).join(' ')
  return this.string
}

ScratchDate.prototype.toString = function() {
  return this.string
}

ScratchMessage.TYPE = {}
ScratchMessage.TYPE.COMMENT          = 0
ScratchMessage.TYPE.REPLY            = 1
ScratchMessage.TYPE.STUDIO_ACTIVITY  = 2
ScratchMessage.TYPE.STUDIO_INVITE    = 3
ScratchMessage.TYPE.FOLLOWED         = 4
ScratchMessage.TYPE.FORUM_POST       = 5
ScratchMessage.TYPE.LOVED            = 6
ScratchMessage.TYPE.FAVORITED        = 7
ScratchMessage.TYPE.REMIXED          = 8

ScratchMessage.DESCS = ['commented on', 'replied to your comment on', 'There was new activity in', 'invited you to curate the studio', 'is now following you', 'There are new posts in the forum thread:', 'loved your project', 'favorited your project', 'remixed your project']
ScratchMessage.DESC_FINDS = [1, 1, 0, 1, 1, 0, 1, 1, 1] // the index at which to look for the string

function ScratchMessage(elem, month, date, year) {
  // ## ScratchMessage
  // #### Generates large amounts of info about a certain message from an element.
  //
  // Parameters:
  //   HTMLElement elem: The message `li` element
  //   Number month: The month the message was sent in. Not used for alerts.
  //   Number date: The date the message was sent in. Not used for alerts.
  //   Number year: The year the message was sent in. Not used for alerts.
  //
  // Instance properties:
  //   HTMLElement parentElement: The `li` element from first argument.
  //   Boolean read
  //   String icon: The classname of the grey icon next to the message, like the speech bubble
  //   Array elements: Array of `HTMLElement`, the children of first argument.
  //   Array snippets: The snippets of comment value found in comment and reply messages.
  //   Boolean isAlert
  //   ScratchDate date
  //   Array links: Array of HTMLElements of tagName 'a', all children of first argument that are links.
  //   Array parts: Array of values of all text-message elements of first argument.
  //   String messageString: All values of `ScratchMessage.parts` joined together.
  //   Number type: Type of the message, one of the values of the static enumerator `ScratchMessage.TYPE`.
  //   Array users: Array of all parts that are usernames.
  //
  // Static properties:
  //   Object<Number> TYPE: Enumerator of the different message types found in `ScratchMessage.type`:
  //     COMMENT, REPLY, STUDIO_ACTIVITY, STUDIO_INVIITE, FOLLOWED, FORUM_POST, LOVED, FAVORITED, REMIXED
  
  var current
    
  this.parentElement = elem
  this.read = elem.className === 'read'
  var classes = elem.getElementsByClassName('icon-xs')[0].className.split(' ')
  this.icon = null
  for(var i = 0; this.icon === null; i++) {
    current = classes[i]
    if(!(current === 'black' || current === 'icon-xs')) this.icon = current
  }
  this.elements = []
  this.snippets = []
  this.isAlert = elem.getAttribute('data-type') === 'notification'
  
  var children = elem.childNodes
  var time = elem.getElementsByClassName('time')[0]
  time = time ? time.innerHTML : undefined
  for(var i = 0; i < children.length; i++) {
    current = children[i]
    if((current.nodeName === '#text' && current.data.trim() !== '') || current.tagName === 'A') {
      this.elements.push(current)
    } else if((current.className || '').split(' ').indexOf('comment-snippet') > -1) {
      this.elements.push(current)
      var val = ScratchMessage.getMessageValue(current)
      this.snippets.push({
        full: val,
        content: val.substring(1, val.length - 5)
      })
    }
  }
  this.parseMessage()
  
  if(this.isAlert) {
    this.date = ScratchDate.fromString(time)
  } else if(time) {
      time = time.split(' ')[0]
      this.date = new ScratchDate(month, date, year, time.split(':')[0], time.split(':')[1])
    } else {
      this.date = new ScratchDate(month, date, year, null, null, false)
    }
}

ScratchMessage.prototype.parseMessage = function() {
  // ## ScratchMessage.parseMessage
  // #### Modifies or creates most of the attributes related to the content of the message. Should be called on changes.
  
  this.links = []
  this.parts = []
  var val, elem
  for(var i = 0; i < this.elements.length; i++) {
    elem = this.elements[i]
    val = ScratchMessage.getMessageValue(elem, val)
    
    this.parts.push(val)
    if(elem.tagName === 'A') {
      this.links.push({ value: val, href: elem.href, elem: elem })
    }
  }
  this.messageString = this.parts.join('')
  
  var type
  for(var i = 0; i < ScratchMessage.DESC_FINDS.length; i++) {
    if(this.parts[ScratchMessage.DESC_FINDS[i]].trim() === ScratchMessage.DESCS[i]) {
      type = i
      this.desc = ScratchMessage.DESCS[i]
      break
    }
  }
  this.type = type
  
  this.users = []
  if(type === 0 || type === 1 || type === 3 || type === 4 || type === 6 || type === 7 || type === 8) { // comment, reply, invite, follow, love, favorite, remix
    this.users.push(this.parts[0])
  }
}

ScratchMessage.prototype.toString = function() {
  return this.messageString
}

ScratchMessage.getMessageValue = function(elem, prev) {
  // ## _static_ ScratchMessage.getMessageValue
  // #### Gets the trimmed and made-readable content of a message element.
  // 
  // Parameters:
  //   HTMLElement elem
  //   String prev: The value returned by this function of the last message. Defaults to `''`.
  
  prev = prev || ''
  var val = decodeHTMLEntities((elem.data || elem.innerHTML).replace(/[\r\n]/g, '').replace(/\s+/g, ' ')) 
  if(prev === '' || prev[prev.length - 1]  === ' ' || val === ' : ') val = val.trimLeft()
  return val
}