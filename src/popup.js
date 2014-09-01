function showCustomElements(event) {
  port.postMessage({ action: 'show-custom-elements', filter: event.target.textContent });
}

function hideCustomElements(event) {
  port.postMessage({ action: 'hide-custom-elements' });
}

function probeBowerComponents(elements) {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', 'https://bower-component-list.herokuapp.com');
  xhr.responseType = 'json';
  xhr.onload = function() {
    if (xhr.readyState === 4 && xhr.status === 200) {
      for (var i = 0; i < elements.length; i++) {
        var results = xhr.response.filter(function(el) {
          return el.name === elements[i].textContent &&
                 el.keywords && el.keywords.indexOf('polymer') !== -1;
        });
        if (results.length > 0) {
          elements[i].querySelector('a').href = results[0].website;
        }
      }
    }
  }
  xhr.send();
}

function parseLinkHeader(header) {
  if (!header) {
    return;
  }
  var parts = header.split(',');
  var links = {};
  for (i=0; i < parts.length; i++) {
    var section = parts[i].split(';');
    var url = section[0].replace(/<|>/g, '').trim();
    var name = section[1].replace(/rel="(.*)"/, '$1').trim();
    links[name] = url;
  }
  return links;
}

function probeGitHub(username, elements, nextUrl) {
  var url = nextUrl || ('https://api.github.com/users/' + username + '/repos');
  var xhr = new XMLHttpRequest();
  xhr.open('GET', url);
  xhr.responseType = 'json';
  xhr.onload = function() {
    if (xhr.readyState === 4 && xhr.status === 200) {
      for (var i = 0; i < elements.length; i++) {
        var results = xhr.response.filter(function(el) {
          return el.name === elements[i].textContent;
        });
        if (results.length > 0) {
          elements[i].querySelector('a').href = results[0].html_url;
        }
      }
      var linkHeader = parseLinkHeader(xhr.getResponseHeader('link'));
      if (linkHeader && linkHeader.next) {
        probeGitHub(username, elements, linkHeader.next);
      }
    }
  }
  xhr.send();
}

function copyTextToClipboard(text) {
  var copyFrom = document.createElement("textarea");
  copyFrom.textContent = text;
  var body = document.getElementsByTagName('body')[0];
  body.appendChild(copyFrom);
  copyFrom.select();
  document.execCommand('copy');
  body.removeChild(copyFrom);
}

var port;

chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
  port = chrome.tabs.connect(tabs[0].id);
  // Send a message to polymer-ready.js to get all custom elements.
  port.postMessage({ action: 'get-custom-elements' });

  port.onMessage.addListener(function(response) {
    var existingElements = document.querySelectorAll('.el');
    var addSeparator = (existingElements.length !== 0);

    response.customElements.forEach(function(el) {
      if (addSeparator) {
        document.body.appendChild(document.createElement('hr'));
        addSeparator = false;
      }
      var anchor = document.createElement('a');
      anchor.target= '_blank';
      anchor.textContent = el;
      var element = document.createElement('div');
      element.classList.add('el');
      element.appendChild(anchor);
      element.addEventListener('mouseenter', showCustomElements);
      element.addEventListener('mouseleave', hideCustomElements);
      document.body.appendChild(element);
    });

    var elements = document.querySelectorAll('.el');
    probeBowerComponents(elements);
    googleElements = Array.prototype.slice.call(elements).filter(function(el) {
      return !el.textContent.indexOf('google-');
    });
    if (googleElements.length) {
      probeGitHub('GoogleWebComponents', googleElements);
    }
    probeGitHub('Polymer', elements);

    var copyButton = document.querySelector('#copy');
    copyButton.addEventListener('click', function() {
      var copyList = '';
      response.customElements.forEach(function(el) {
        if (copyList === '')
          copyList = el;
        else
          copyList += ', ' + el;
      });
      copyTextToClipboard(copyList);
      copyButton.innerHTML = 'Copied!';
    });
  });
});
