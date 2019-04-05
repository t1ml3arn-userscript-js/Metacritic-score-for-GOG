// ==UserScript==
// @name Metacritic score for GOG
// @namespace https://github.com/T1mL3arn
// @match https://gog.com/*
// @match https://www.gog.com/*
// @require https://code.jquery.com/jquery-3.3.1.min.js
// @grant GM_xmlhttpRequest
// @grant GM.xmlhttpRequest
// @grant GM_xmlHttpRequest
// @grant GM.xmlHttpRequest
// ==/UserScript==

(function () {

	const defaultHeaders = {
		"Origin": null,
		"Referer": null,
	}

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

	// =============================================================
	//
	// 1. Кроссдоменный запрос к быстропоиску метакритика (FAIL)
	//
	// =============================================================
	
	// Не получилось отправить кроссдоменный запрос.
	// Потому, что нужно использовать Violentmonkey API
	let args = {
		url: "https://www.metacritic.com/autosearch",
		method: "POST",
		dataType: "json",
		data: { image_size: 98, search_term: "mass effect"},
		headers: {
			"Origin": null,
			"Referer": "https://www.metacritic.com/search/all/fallout/results"
		},
		beforeSend: (xhr) => {
			xhr.setRequestHeader("Origin", null);
			xhr.setRequestHeader("Referer", "https://www.metacritic.com/search/all/fallout/results");
		},
		crossDomain: true,
	}
	
	// $.ajax(args).done( result => console.log(result) )

	// =============================================================
	//
	// 2. Crossdomain request to the raw search page (not an API call)
	//
	// FAILED cause I cannot do corssdomain requests in userscript
	// with standart API. I have to use special Violenmonkey API
	//
	// =============================================================

	/**
	
	 https://www.metacritic.com/search/game/mass-effect/results?search_type=advanced&plats[3]=1

	 searches "mass-effect" only in "game" for PC platform (plats[3]=1)

	 */
	
	let game = 'mass effect'
	ajax({
		url: getSearhURL(game),
		method: "GET",
		headers: defaultHeaders,
		context: { game }
	})
		.then(response => {
				const { context, responseText } = response
				const results = parseSearchResults(responseText)

				if (results.length == 0) {
					throw `There is no game with title ${context.game}`
				}

				// I have to sort results and this is not so easy,
				// metacritic gives stupid order, e.g
				// most relevant game for "mass effect" is ME: Andromeda,
				// not the first Mass Effect game from 2007.
				// lets assume that GOG has correct game titles
				// then we can get game from results with the same
				// title as in search query
				const ind = results.findIndex(result => result.title.toLowerCase()===context.game.toLowerCase())
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
				
				console.log(gameData)
			},
				// catches error when fetching game page
				e => console.error(e)
		)

	
})();