let accessToken = null;
let allActivities = [];
let athleteData = null;

// Check if we're returning from OAuth (in popup)
window.addEventListener('load', () => {
	const urlParams = new URLSearchParams(window.location.search);
	const code = urlParams.get('code');
	const error = urlParams.get('error');
	
	// If this is a popup window with OAuth response
	if (window.opener && (code || error)) {
		// Send message to parent window
		window.opener.postMessage({
			type: 'strava-auth',
			code: code,
			error: error
		}, window.location.origin);
		
		// Close popup
		window.close();
		return;
	}
	
	// Restore saved data on page load
	restoreSavedData();
});

function restoreSavedData() {
	// Restore access token
	const savedToken = sessionStorage.getItem('stravaToken');
	if (savedToken) {
		accessToken = savedToken;
		showRequestButton();
	}
	
	// Restore Strava data if it exists
	const savedData = sessionStorage.getItem('stravaData');
	if (savedData) {
		try {
			const parsedData = JSON.parse(savedData);
			
			// Only proceed if we actually have data
			if (parsedData && parsedData.length > 0) {
				// Convert date strings back to Date objects
				const stravaRuns = parsedData.map(r => ({
					...r,
					date: new Date(r.date)
				}));
				
				// Call analyze with the restored data
				analyze(stravaRuns, 'Strava Restore');
				
				// Show session info banner instead of feedback message
				showStravaSessionBanner(stravaRuns.length);
			}
		} catch (err) {
			console.error('Error restoring saved data:', err);
			sessionStorage.removeItem('stravaData');
		}
	}
}

function showStravaSessionBanner(activityCount) {
	const banner = document.getElementById('stravaSessionInfo');
	if (banner) {
		banner.style.display = 'flex';
		const countSpan = banner.querySelector('#stravaActivityCount');
		if (countSpan) {
			countSpan.textContent = activityCount;
		}
	}
}

function clearStravaData() {
	sessionStorage.removeItem('stravaData');
	sessionStorage.removeItem('stravaToken');
	sessionStorage.removeItem('stravaClientId');
	sessionStorage.removeItem('stravaClientSecret');
	
	// Hide the banner
	const banner = document.getElementById('stravaSessionInfo');
	if (banner) {
		banner.style.display = 'none';
	}
	
	// Reload the page to reset everything
	location.reload();
}

function initiateAuth() {
	const clientId = document.getElementById('clientId').value.trim();
	const clientSecret = document.getElementById('clientSecret').value.trim();
	
	if (!clientId || !clientSecret) {
		showError('Please enter both Client ID and Client Secret');
		return;
	}
	
	// Store credentials temporarily
	sessionStorage.setItem('stravaClientId', clientId);
	sessionStorage.setItem('stravaClientSecret', clientSecret);
	
	const redirectUri = window.location.origin + window.location.pathname;
	
	// DEBUG: Show what redirect URI is being used
	console.log('Redirect URI being sent:', redirectUri);
	alert('Redirect URI: ' + redirectUri + '\n\nMake sure this EXACTLY matches your Strava API settings!');
	
	const scope = 'read,activity:read_all,profile:read_all';
	
	const authUrl = `https://www.strava.com/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&approval_prompt=force&scope=${scope}`;
	
	// Open popup window
	const width = 600;
	const height = 700;
	const left = (screen.width / 2) - (width / 2);
	const top = (screen.height / 2) - (height / 2);
	
	const popup = window.open(
		authUrl,
		'Strava Authorization',
		`width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
	);
	
	// Check if popup was blocked
	if (!popup || popup.closed || typeof popup.closed === 'undefined') {
		showError('Popup was blocked! Please allow popups for this site.');
		return;
	}
	
	// Listen for the popup to send back the code
	window.addEventListener('message', handleAuthMessage);
}

function handleAuthMessage(event) {
	// Security: verify origin if needed
	// if (event.origin !== window.location.origin) return;
	
	if (event.data && event.data.type === 'strava-auth') {
		window.removeEventListener('message', handleAuthMessage);
		
		if (event.data.code) {
			exchangeToken(event.data.code);
		} else if (event.data.error) {
			showError('Authorization denied or failed');
		}
	}
}

async function exchangeToken(code) {
	const clientId = sessionStorage.getItem('stravaClientId');
	const clientSecret = sessionStorage.getItem('stravaClientSecret');
	
	if (!clientId || !clientSecret) {
		showError('Missing credentials. Please try again.');
		return;
	}
	
	try {
		const response = await fetch('https://www.strava.com/oauth/token', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				client_id: clientId,
				client_secret: clientSecret,
				code: code,
				grant_type: 'authorization_code'
			})
		});
		
		const data = await response.json();
		
		if (data.access_token) {
			accessToken = data.access_token;
			sessionStorage.setItem('stravaToken', accessToken);
			
			// Clean URL
			window.history.replaceState({}, document.title, window.location.pathname);
			
			// Show the request button instead of auto-fetching
			showRequestButton();
		} else {
			showError('Failed to obtain access token');
		}
	} catch (err) {
		showError('Error connecting to Strava: ' + err.message);
	}
}

function showRequestButton() {
	document.getElementById('connectBtn').style.display = 'none';
	document.getElementById('clientId').disabled = true;
	document.getElementById('clientSecret').disabled = true;
	document.getElementById('requestSection').style.display = 'block';
}

async function fetchStravaData() {
	// Show loading feedback
	showFeedback('⏳ Fetching data from Strava...', 'info');
	
	try {
		// Fetch athlete data
		const athleteResponse = await fetch('https://www.strava.com/api/v3/athlete', {
			headers: {
				'Authorization': `Bearer ${accessToken}`
			}
		});
		
		if (!athleteResponse.ok) {
			throw new Error(`Athlete fetch failed: ${athleteResponse.status}`);
		}
		
		const athlete = await athleteResponse.json();
		
		// Fetch activities list
		const activitiesResponse = await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=30', {
			headers: {
				'Authorization': `Bearer ${accessToken}`
			}
		});
		
		if (!activitiesResponse.ok) {
			throw new Error(`Activities fetch failed: ${activitiesResponse.status}`);
		}
		
		const activitiesList = await activitiesResponse.json();
		
		showFeedback(`⏳ Fetching detailed data for ${activitiesList.length} activities...`, 'info');
		
		// Fetch detailed data for each activity
		const detailedActivities = await Promise.all(
			activitiesList.map(async (activity) => {
				const detailResponse = await fetch(`https://www.strava.com/api/v3/activities/${activity.id}`, {
					headers: {
						'Authorization': `Bearer ${accessToken}`
					}
				});
				
				if (!detailResponse.ok) {
					console.warn(`Failed to fetch details for activity ${activity.id}`);
					return activity; // Return basic data if detailed fetch fails
				}
				
				return await detailResponse.json();
			})
		);
		stravaData = detailedActivities;
		
		const stravaRuns = stravaData
			.filter(r => r.type === "Run")
			.map(r => ({
				id: r.id, // Keep the Strava ID
				date: new Date(r.start_date),
				distance: r.distance / 1000,
				duration: r.moving_time / 60,
				avgHR: r.average_heartrate || null,
				maxHR: r.max_heartrate || null
		}))
		.filter(r => r.distance && r.duration && !isNaN(r.date.getTime()));
		
		// Save the processed data to sessionStorage
		sessionStorage.setItem('stravaData', JSON.stringify(stravaRuns));
		
		console.log("after Strava Fetch");
		console.log(stravaRuns);
		
		analyze(stravaRuns, 'Strava');
		
		showFeedback(`✅ Successfully fetched ${detailedActivities.length} activities from Strava!`, 'success');
	} catch (err) {
		console.error('Strava fetch error:', err);
		showFeedback(`❌ Error fetching Strava data: ${err.message}`, 'error');
	}
}

function showFeedback(message, type = 'info') {
	const feedbackDiv = document.getElementById('feedbackMessage');
	
	if (!feedbackDiv) {
		console.warn('feedbackMessage element not found');
		return;
	}
	
	if (type === 'success') {
		feedbackDiv.className = 'success';
	} else if (type === 'error') {
		feedbackDiv.className = 'error';
	} else if (type === 'warning') {
		feedbackDiv.className = 'warning';
	} else {
		feedbackDiv.className = 'info-box';
	}
	
	feedbackDiv.textContent = message;
	
	// Auto-hide only for success messages (not errors!)
	if (type === 'success') {
		setTimeout(() => {
			feedbackDiv.textContent = '';
			feedbackDiv.className = '';
		}, 5000);
	}
	// Errors and warnings stay visible until manually cleared
}

// Optional: Add a function to clear saved data if needed
function clearSavedData() {
	sessionStorage.removeItem('stravaData');
	sessionStorage.removeItem('stravaToken');
	sessionStorage.removeItem('stravaClientId');
	sessionStorage.removeItem('stravaClientSecret');
	showFeedback('🗑️ Saved data cleared', 'info');
}