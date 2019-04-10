/* 
    Metacritic score for GOG - Adds metacritic score to GOG game's page.
	Copyright (C) 2019  T1mL3arn
	
    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.
	
    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.
    You should have received a copy of the GNU General Public License
    along with this program. If not, see <https://www.gnu.org/licenses/>.
*/

// ==UserScript==
// @name Metacritic score for GOG
// @description Adds metacritic score to GOG game's page
// @version 1.0
// @author T1mL3arn
// @namespace https://github.com/T1mL3arn
// @icon https://upload.wikimedia.org/wikipedia/commons/thumb/2/20/Metacritic.svg/88px-Metacritic.svg.png
// @match https://gog.com/game/*
// @match https://www.gog.com/game/*
// @require https://code.jquery.com/jquery-3.3.1.min.js
// @grant GM_xmlhttpRequest
// @grant GM.xmlhttpRequest
// @grant GM_xmlHttpRequest
// @grant GM.xmlHttpRequest
// @grant GM_addStyle
// @grant GM.addStyle
// @license GPLv3
// @homepageURL https://github.com/t1ml3arn-userscript-js/Metacritic-score-for-GOG
// @supportURL https://github.com/t1ml3arn-userscript-js/Metacritic-score-for-GOG/issues
// ==/UserScript==

(function () {
	// =============================================================
	//
	// Greasemonkey polyfill
	//
	// =============================================================
	
	// probably it is Greasemonkey
	if (typeof GM !== 'undefined') {
		if (typeof GM.info !== 'undefined')
			window.GM_info = GM.info;

		// VM has GM_xmlhttpRequest but GM has GM_xmlHttpRequest
		// Mad mad world !
		if (typeof GM.xmlHttpRequest !== 'undefined') {
			window.GM_xmlhttpRequest = GM.xmlHttpRequest
		}
    
    	// addStyle
		window.GM_addStyle = function(css) {
			return new Promise((resolve, reject) => {
				try {
					let style = document.head.appendChild(document.createElement('style'))
					style.type = 'text/css'
					style.textContent = css;
					resolve(style)
				} catch(e) {
					console.error(`It is not possible to add style with GM_addStyle()`)
					reject(e)
				}
			})
		}
	}

	//console.log(`[${GM_info.scriptHandler}][${GM_info.script.name} v${GM_info.script.version}] inited`)
	

	// =============================================================
	//
	// API section
	//
	// =============================================================

	const css = (() => {
		return `
.mcg-wrap {
	/* Base size for all icons */
	--size: 80px;

	display: flex;
	flex-flow: row;
	flex-wrap: wrap;
	align-items: center;
	justify-content: center;

	width: auto;
	padding: 4px;
	box-sizing: border-box;
}

.mcg-wrap * {
	all: unset;
	box-sizing: border-box;
}

.mcg-score-summary {
	display: flex;
	flex-flow: row nowrap;
	justify-content: flex-start;
	align-items: center;

	margin: 0 2px 0 2px;
}

.mcg-score-summary__score {
	display: flex;
	flex-flow: row;
	justify-content: center;
	align-items: center;

	min-width: calc(var(--size) * 0.5);
	min-height: calc(var(--size) * 0.5);
	width: calc(var(--size) * 0.5);
	height: calc(var(--size) * 0.5);
	margin: 0 4px 0 4px;

	background-color: #0f0;
	background-color: #c0c0c0;
	border-radius: 6px;
	font-family: sans-serif;
	
	font-size: 1.2em;
	font-weight: bold;
	color: white;
}

.mcg-score--bad {
	background-color: #f00;
	color: white;
}

.mcg-score--mixed {
	background-color: #fc3;
	color: #111;
}

.mcg-score--good {
	background-color: #6c3;
	color: white;
}

.mcg-score-summary__score--circle {
	border-radius: 50%;
}

.mcg-score-summary .mcg-score-summary__label {
	align-self: flex-start;
	align-self: center;
	
	max-width: 50px;

	font-size: 0.9em;
	font-size: 14px;
	font-weight: bold;
	text-align: left;
	text-align: center;
}

.mcg-logo {
	display: flex;
	flex-flow: row;
	align-items: center;
}

.mcg-logo__img {
	background-image: url(https://upload.wikimedia.org/wikipedia/commons/thumb/2/20/Metacritic.svg/200px-Metacritic.svg.png);
	background-position: center center;
	background-size: cover;
	
	min-width: calc(var(--size) * 0.5);
	min-height: calc(var(--size) * 0.5);
	width: calc(var(--size) * 0.5);
	height: calc(var(--size) * 0.5);
}

.mcg-logo p {
	display: flex;
	flex-flow: column;
	align-items: center;
	justify-content: center;

	margin: 4px 6px;

	font-family: sans-serif;
	font-size: 22px;
	text-align: center;
	font-weight: bold;
}

.mcg-logo p > a {
	cursor: pointer;
	
	text-decoration: underline;
	font-size: 0.65em;
	font-size: 14px;
	font-weight: normal;
	color: #36c;
}`
	})()

	const defaultHeaders = {
		"Origin": null,
		"Referer": null,
	}

	/**
	 * Sends xmlHttpRequest via GM api (this allows crossdomain reqeusts).
	 * NOTE Different userscript engines support different
	 * details object format.
	 * 
	 * Violentmonkey @see https://violentmonkey.github.io/api/gm/#gm_xmlhttprequest
	 * 
	 * Greasemonkey @see https://wiki.greasespot.net/GM.xmlHttpRequest
	 * @param {Object} details @see ...
	 * @returns {Promise}
	 */
	function ajax(details) {
		return new Promise((resolve, reject) => {
			details.onloadend = resolve
			details.onerror = reject
			GM_xmlhttpRequest(details)
		}) 
	}

	/**
	 * Returns an URL to make a search request
	 * for given game.
	 * @param {String} game Game name
	 * @param {String} platform Target platform (PC is default)
	 */
	function getSearhURL(game, platform) {
		// searches GAME only in "game" for PC platform (plats[3]=1)
		///TODO sanitize game name (trim, remove extra spacebars etc) ?
		return `https://www.metacritic.com/search/game/${game}/results?search_type=advanced&plats[3]=1`
	}

	/**
	 * Returns an array of search results from given html code
	 * @param {String} html Raw html from which seach results will be parsed
	 */
	function parseSearchResults(html) {
		
		const doc = new DOMParser().parseFromString(html, 'text/html')
		const yearReg = /\d{4}/
		const results = $(doc).find('ul.search_results .result_wrap')

		return results.map((ind, elt) => {
			const result = $(elt)
			let year = yearReg.exec(result.find('.main_stats p').text())
			year = year == null ? 0 : parseInt(year[0])
			
			return {
				title: result.find('.product_title').text().trim(),
				pageurl: 'https://www.metacritic.com' + result.find('.product_title > a').attr('href'),
				platform: result.find('.platform').text().trim(),
				year,
				metascore: parseInt(result.find('.metascore_w').text()),
				criticReviewsCount: 0,
				userscore: 0.0,
				userReviewsCount: 0,
				description: result.find('.deck').text().trim()
			}
		})
		.get()
	}

	function swap(arr, ind1, ind2) {
		const tmp = arr[ind1]
		arr[ind1] = arr[ind2]
		arr[ind2] = tmp
	}

	/**
	 * Returns integer which represents total user reviews
	 * @param {Object} doc jQuery document object
	 * @returns {Number}
	 */
	function getUserReviesCount(doc) {
		const reg = /\d+/
		let count = doc.find('.feature_userscore .count a').text()
		count = reg.exec(count)
		count = count == null ? 0 : parseInt(count[0])
		return count;
	}

	/**
	 * Returns float which represents user score
	 * @param {Object} doc jQuery document object
	 * @returns {Number}
	 */
	function getUserScore(doc) {
		return parseFloat(doc.find('.feature_userscore .metascore_w.user').eq(0).text())
	}
	
	/**
	 * Returns a number of crititc reviews
	 * @param {Object} doc jQuery document object
	 * @returns {Number}
	 */
	function getCriticReviewsCount(doc) {
		return parseInt(doc.find('.score_summary.metascore_summary a>span').text())
	}

	/**
	 * Converts given object to string 
	 * like `foo=bar&bizz=bazz`
	 * @param {Object} obj 
	 */
	function objectToUrlArgs(obj) {
		return Object.entries(obj)
			.map(kv => `${kv[0]}=${kv[1]}`)
			.join('&')
	}

	/**
	 * Query metacritic autosearch api.
	 * Returns Promise with an array with results objects.
	 * Result object properties:
	 * - url: link to page
	 * - name: game name
	 * - itemDate: release date (string ?)
	 * - imagePath: url to cover image
	 * - metaScore: critic score (int)
	 * - scoreWord: like mixed, good, bad etc
	 * - refType: item type, e.g "PC Game"
	 * - refTypeId: type id, (string)
	 * @param {String} query term for search
	 * @returns {Promise}
	 */
	function autoSearch(query) {
		return ajax({
			url: 'https://www.metacritic.com/autosearch',
			method: 'post',
			data: objectToUrlArgs({ image_size: 98, search_term: query }),
			responseType: 'json',
			// Strictly recomended to watch Network log
			// and get Request Headers from it
			headers: {
				"Origin": null,
				"Referer": "https://www.metacritic.com",
				"Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
				"X-Requested-With":	"XMLHttpRequest"
			}
		})
		.then(response => JSON.parse(response.responseText).autoComplete)
	}

	/**
	 * Queries metacritic search page with given query.
	 * Returns Promise with `response` object.
	 * Html code of the page can be read from `response.responseText`
	 * @param {String} query term for search
	 * @returns {Promise}
	 */
	function fullSearch(query) {
		return ajax({
			url: getSearhURL(query),
			method: "GET",
			headers: defaultHeaders,
			context: { query }
		})
	}

	/**
	 * Returns a resolved Promise with game data object on success
	 * and rejected Promise on failure.
	 * Game data object has these fields:
	 * - title: Game title
	 * - pageurl: Game page url
	 * - platform: Game platform (pc, ps3 etc)
	 * - year: Release year (int)
	 * - metascore: Critic score (int)
	 * - criticReviewsCount: The number of critic reviews
	 * - userscore: User score (float)
	 * - userReviewsCount: The number of user reviews
	 * - description: Description of the game
	 * - queryString: Original query string
	 * @param {String} gameName Game name
	 */
	function getGameData(gameName) {
		return fullSearch(gameName)
			.then(response => {
					const { context, responseText } = response
					const results = parseSearchResults(responseText)

					if (results.length == 0) {
						throw `There is no game with title ${context.query}`
					}

					// I have to sort results and this is not so easy,
					// metacritic gives stupid order, e.g
					// most relevant game for "mass effect" is ME: Andromeda,
					// not the first Mass Effect game from 2007.
					// lets assume that GOG has correct game titles
					// then we can get game from results with the same
					// title as in search query
					const ind = results.findIndex(result => result.title.toLowerCase()===context.query.toLowerCase())
					if (ind != -1) {
						const res = results.splice(ind, 1)[0]
						results.unshift(res)
					}

					return results[0]
				},
					e => console.error("Network Error", e)
			)
			.then(gameData => {

					// request to the game page to get
					// user score and reviews count
					return ajax({
						url: gameData.pageurl,
						method: 'GET',
						headers: defaultHeaders,
						context: { gameData },
					})
				},
					// catches error, if there is no such game
					e => console.error(e)
			).then(response => {
					const { context, responseText } = response
					const { gameData } = context
					const doc = $(new DOMParser().parseFromString(responseText, 'text/html'))

					gameData.userReviewsCount = getUserReviesCount(doc)
					gameData.userscore = getUserScore(doc)
					gameData.criticReviewsCount = getCriticReviewsCount(doc)
					
					return { ...gameData, queryString: gameName }
				},
					// catches error when fetching game page
					e => console.error(e)
			);
	}

	function MetacriticLogo(props) {
		let { reviewsUrl } = props

		return `
			<div class="mcg-logo">
				<div class="mcg-logo__img" title="metacritic logo"></div>
				<p>
					metacritic
					<a href=${ reviewsUrl || "#" } target="_blank" rel="noopener noreferer">
						Read reviews
						<img src="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22%3E %3Cpath fill=%22%23fff%22 stroke=%22%2336c%22 d=%22M1.5 4.518h5.982V10.5H1.5z%22/%3E %3Cpath fill=%22%2336c%22 d=%22M5.765 1H11v5.39L9.427 7.937l-1.31-1.31L5.393 9.35l-2.69-2.688 2.81-2.808L4.2 2.544z%22/%3E %3Cpath fill=%22%23fff%22 d=%22M9.995 2.004l.022 4.885L8.2 5.07 5.32 7.95 4.09 6.723l2.882-2.88-1.85-1.852z%22/%3E %3C/svg%3E" />
					</a>
				</p>
			</div>
		`
	}

	function getScoreColor(score) {
		// tbd - gray
		// 0-49 - red
		// 50-74 - yellow
		// 75 - 100 - green
	
		if (score === 'tbd' || score !== score)
			// default bg color is already present in css
			return ''
		else {
			// convert score to 100 scale
			if (Math.floor(score) !== score) score = score * 10
			if (score < 50)			return 'mcg-score--bad'
			else if (score < 75)	return 'mcg-score--mixed'
			else					return 'mcg-score--good'
		}
	}

	function ScoreSummary(props) {
		const { score, scoreLabel, scoreTypeClass } = props
		const scoreText = (score !== score) ? "tbd" : score;
		const scoreEltClass = `"mcg-score-summary__score ${scoreTypeClass} ${ getScoreColor(score) }"`
		
		return `
			<div class="mcg-score-summary">
				<span class=${ scoreEltClass }>${ scoreText }</span>
				<span class="mcg-score-summary__label">${ scoreLabel }</span>
			</div>
		`
	}

	function MetacriticScore(props) {
		const { metascore, userscore, pageurl } = props;

		return `
		<div class='mcg-wrap'>
			${ ScoreSummary({ 
				score: userscore, 
				scoreLabel: 'User score', 
				scoreTypeClass: 'mcg-score-summary__score--circle' 
				}) 
			}
			${ ScoreSummary({ 
				score: metascore, 
				scoreLabel: 'Meta score',
				scoreTypeClass: ""
				})
			}
			${ MetacriticLogo({ reviewsUrl: pageurl }) }
		</div>
		`
	}

	// =============================================================
	//
	// Code section
	//
	// =============================================================

	GM_addStyle(css).then(style => style.id = 'metacritic-for-gog')
	
	// getting game title
	const title = document.getElementsByClassName("productcard-basics__title")[0]

	// process request to metacritic
	getGameData(title.textContent).then(data => {
		
		const metascore = MetacriticScore(data) 
		$('div[content-summary-section-id="productDetails"] > .details')
			.append('<hr class="details__separator"/>')
			.append(metascore)
			.append('<hr class="details__separator"/>')
	})
	
})();