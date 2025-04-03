(function () {
    const mod = (n, m) => ((n % m) + m) % m;
    const baseDictionary = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz~-';
    const shuffledIndicator = '_rhs';
    const generateDictionary = function () {
        let str = '';
        const split = baseDictionary.split('');
        while (split.length > 0) {
            str += split.splice(Math.floor(Math.random() * split.length), 1)[0];
        }
        return str;
    };
    class StrShuffler {
        constructor(dictionary = generateDictionary()) {
            this.dictionary = dictionary;
        }
        shuffle(str) {
            if (str.startsWith(shuffledIndicator)) {
                return str;
            }
            let shuffledStr = '';
            for (let i = 0; i < str.length; i++) {
                const char = str.charAt(i);
                const idx = baseDictionary.indexOf(char);
                if (char === '%' && str.length - i >= 3) {
                    shuffledStr += char;
                    shuffledStr += str.charAt(++i);
                    shuffledStr += str.charAt(++i);
                } else if (idx === -1) {
                    shuffledStr += char;
                } else {
                    shuffledStr += this.dictionary.charAt(mod(idx + i, baseDictionary.length));
                }
            }
            return shuffledIndicator + shuffledStr;
        }
        unshuffle(str) {
            if (!str.startsWith(shuffledIndicator)) {
                return str;
            }

            str = str.slice(shuffledIndicator.length);

            let unshuffledStr = '';
            for (let i = 0; i < str.length; i++) {
                const char = str.charAt(i);
                const idx = this.dictionary.indexOf(char);
                if (char === '%' && str.length - i >= 3) {
                    unshuffledStr += char;
                    unshuffledStr += str.charAt(++i);
                    unshuffledStr += str.charAt(++i);
                } else if (idx === -1) {
                    unshuffledStr += char;
                } else {
                    unshuffledStr += baseDictionary.charAt(mod(idx - i, baseDictionary.length));
                }
            }
            return unshuffledStr;
        }
    }

    function setError(err) {
        var element = document.getElementById('error-text');
        if (err) {
            element.style.display = 'block';
            element.textContent = 'An error occurred: ' + err;
        } else {
            element.style.display = 'none';
            element.textContent = '';
        }
    }
    function getPassword() {
        var element = document.getElementById('session-password');
        return element ? element.value : '';
    }
    function get(url, callback, shush = false) {
        var pwd = getPassword();
        if (pwd) {
            // really cheap way of adding a query parameter
            if (url.includes('?')) {
                url += '&pwd=' + pwd;
            } else {
                url += '?pwd=' + pwd;
            }
        }

        var request = new XMLHttpRequest();
        request.open('GET', url, true);
        request.send();

        request.onerror = function () {
            if (!shush) setError('Cannot communicate with the server');
        };
        request.onload = function () {
            if (request.status === 200) {
                callback(request.responseText);
            } else {
                if (!shush)
                    setError(
                        'unexpected server response to not match "200". Server says "' + request.responseText + '"'
                    );
            }
        };
    }

    var api = {
        needpassword(callback) {
            get('/needpassword', value => callback(value === 'true'));
        },
        newsession(callback) {
            get('/newsession', callback);
        },
        editsession(id, httpProxy, enableShuffling, callback) {
            get(
                '/editsession?id=' +
                encodeURIComponent(id) +
                (httpProxy ? '&httpProxy=' + encodeURIComponent(httpProxy) : '') +
                '&enableShuffling=' + (enableShuffling ? '1' : '0'),
                function (res) {
                    if (res !== 'Success') return setError('unexpected response from server. received ' + res);
                    callback();
                }
            );
        },
        sessionexists(id, callback) {
            get('/sessionexists?id=' + encodeURIComponent(id), function (res) {
                if (res === 'exists') return callback(true);
                if (res === 'not found') return callback(false);
                setError('unexpected response from server. received' + res);
            });
        },
        deletesession(id, callback) {
            api.sessionexists(id, function (exists) {
                if (exists) {
                    get('/deletesession?id=' + id, function (res) {
                        if (res !== 'Success' && res !== 'not found')
                            return setError('unexpected response from server. received ' + res);
                        callback();
                    });
                } else {
                    callback();
                }
            });
        },
        shuffleDict(id, callback) {
            get('/api/shuffleDict?id=' + encodeURIComponent(id), function (res) {
                callback(JSON.parse(res));
            });
        }
    };

    var localStorageKey = 'rammerhead_sessionids';
    var localStorageKeyDefault = 'rammerhead_default_sessionid';
    var sessionIdsStore = {
        get() {
            var rawData = localStorage.getItem(localStorageKey);
            if (!rawData) return [];
            try {
                var data = JSON.parse(rawData);
                if (!Array.isArray(data)) throw 'getout';
                return data;
            } catch (e) {
                return [];
            }
        },
        set(data) {
            if (!data || !Array.isArray(data)) throw new TypeError('must be array');
            localStorage.setItem(localStorageKey, JSON.stringify(data));
        },
        getDefault() {
            var sessionId = localStorage.getItem(localStorageKeyDefault);
            if (sessionId) {
                var data = sessionIdsStore.get();
                data.filter(function (e) {
                    return e.id === sessionId;
                });
                if (data.length) return data[0];
            }
            return null;
        },
        setDefault(id) {
            localStorage.setItem(localStorageKeyDefault, id);
        }
    };

    // Replace your existing renderSessionTable with this version:
    function renderSessionTable(data) {
        var tbody = document.getElementById('sessions-popup-tbody');
        while (tbody.firstChild) {
            tbody.removeChild(tbody.firstChild);
        }
        for (var i = 0; i < data.length; i++) {
            var tr = document.createElement('tr');
    
            // Session ID cell
            var tdId = document.createElement('td');
            tdId.textContent = data[i].id;
            tr.appendChild(tdId);
    
            // Created On cell
            var tdCreated = document.createElement('td');
            tdCreated.textContent = data[i].createdOn;
            tr.appendChild(tdCreated);
    
            // Actions cell (Fill and Delete buttons)
            var tdActions = document.createElement('td');
    
            var fillInBtn = document.createElement('button');
            fillInBtn.textContent = 'Fill in';
            fillInBtn.className = 'btn btn-outline-primary btn-sm';
            fillInBtn.onclick = (function(idx) {
                return function() {
                    setError();
                    sessionIdsStore.setDefault(data[idx].id);
                    loadSettings(data[idx]);
                    hideSessionsPopup();
                };
            })(i);
            tdActions.appendChild(fillInBtn);
    
            var deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'Delete';
            deleteBtn.className = 'btn btn-outline-danger btn-sm ml-2';
            deleteBtn.onclick = (function(idx) {
                return function() {
                    setError();
                    api.deletesession(data[idx].id, function () {
                        data.splice(idx, 1)[0];
                        sessionIdsStore.set(data);
                        renderSessionTable(data);
                    });
                };
            })(i);
            tdActions.appendChild(deleteBtn);
    
            tr.appendChild(tdActions);
            tbody.appendChild(tr);
        }
    }
    
    // Show popup function
    function showSessionsPopup() {
        document.getElementById('sessions-popup-overlay').style.display = 'block';
        document.getElementById('sessions-popup-container').style.display = 'block';
    }
    
    // Hide popup function
    function hideSessionsPopup() {
        document.getElementById('sessions-popup-overlay').style.display = 'none';
        document.getElementById('sessions-popup-container').style.display = 'none';
    }
    
    // Add event listener for "View Sessions" button and popup close button
    window.addEventListener('load', function() {
        document.getElementById('view-sessions-btn').addEventListener('click', function() {
            // Before showing, reload sessions to update table
            loadSessions();
            showSessionsPopup();
        });
        document.getElementById('sessions-popup-close').addEventListener('click', hideSessionsPopup);
        // Also hide popup when clicking the overlay
        document.getElementById('sessions-popup-overlay').addEventListener('click', hideSessionsPopup);
    });
    function loadSettings(session) {
        document.getElementById('session-id').value = session.id;
        document.getElementById('session-httpproxy').value = session.httpproxy || '';
        document.getElementById('session-shuffling').checked = typeof session.enableShuffling === 'boolean' ? session.enableShuffling : true;
    }
    function loadSessions() {
        var sessions = sessionIdsStore.get();
        var defaultSession = sessionIdsStore.getDefault();
        if (defaultSession) loadSettings(defaultSession);
        renderSessionTable(sessions);
    }
    function addSession(id) {
        var data = sessionIdsStore.get();
        data.unshift({ id: id, createdOn: new Date().toLocaleString() });
        sessionIdsStore.set(data);
        renderSessionTable(data);
    }
    function editSession(id, httpproxy, enableShuffling) {
        var data = sessionIdsStore.get();
        for (var i = 0; i < data.length; i++) {
            if (data[i].id === id) {
                data[i].httpproxy = httpproxy;
                data[i].enableShuffling = enableShuffling;
                sessionIdsStore.set(data);
                return;
            }
        }
        throw new TypeError('cannot find ' + id);
    }

    get('/mainport', function (data) {
        var defaultPort = window.location.protocol === 'https:' ? 443 : 80;
        var currentPort = window.location.port || defaultPort;
        var mainPort = data || defaultPort;
        if (currentPort != mainPort) window.location.port = mainPort;
    });

    api.needpassword(doNeed => {
        if (doNeed) {
            document.getElementById('password-wrapper').style.display = '';
        }
    });
    window.addEventListener('load', function () {
        loadSessions();

        var showingAdvancedOptions = false;
        document.getElementById('session-advanced-toggle').onclick = function () {
            // eslint-disable-next-line no-cond-assign
            document.getElementById('session-advanced-container').style.display = (showingAdvancedOptions =
                !showingAdvancedOptions)
                ? 'block'
                : 'none';
        };

        document.getElementById('session-create-btn').onclick = function () {
            setError();
            api.newsession(function (id) {
                addSession(id);
                document.getElementById('session-id').value = id;
                document.getElementById('session-httpproxy').value = '';
            });
        };
        function go() {
            setError();
            var id = document.getElementById('session-id').value;
            var httpproxy = document.getElementById('session-httpproxy').value;
            var enableShuffling = document.getElementById('session-shuffling').checked;
            var url = document.getElementById('session-url').value || 'https://www.google.com/';
            if (!id) return setError('must generate a session id first');
            api.sessionexists(id, function (value) {
                if (!value) return setError('session does not exist. try deleting or generating a new session');
                api.editsession(id, httpproxy, enableShuffling, function () {
                    editSession(id, httpproxy, enableShuffling);
                    api.shuffleDict(id, function (shuffleDict) {
                        if (!shuffleDict) {
                            window.location.href = '/' + id + '/' + url;
                        } else {
                            var shuffler = new StrShuffler(shuffleDict);
                            window.location.href = '/' + id + '/' + shuffler.shuffle(url);
                        }
                    });
                });
            });
        }
        document.getElementById('session-go').onclick = go;
        document.getElementById('session-url').onkeydown = function (event) {
            if (event.key === 'Enter') go();
        };
    });
})();
