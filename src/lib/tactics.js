// Rule-based tactical analysis. Turns the information recorded for a match
// (weather, pitch, ground, format, observations) into explained considerations.
// Everything returned is advice to consider, never a guaranteed outcome.
import { rainLevel, compass } from './weather.js';
import { formatInfo, isPace, isSpin, playerName } from '../data/model.js';
import { AREA_PROTECTION, POSITION_BY_ID, SCORING_AREA_BY_ID } from '../data/positions.js';

const known = (v) => v && v !== 'Unknown';
const yesish = (v) => v === 'Yes' || v === 'Somewhat';
const levelOf = (score) => (score >= 65 ? 'Favourable' : score >= 45 ? 'Moderate' : 'Less favourable');
const clamp = (n) => Math.max(5, Math.min(95, n));

export function analyseMatch(match, players = []) {
  const md = match?.matchDay || {};
  const pitch = md.pitch || {};
  const wx = md.weather?.status === 'ok' ? md.weather.summary : null;
  const fmt = formatInfo(match);
  const rain = rainLevel(wx);
  const history = md.groundHistory || {};

  const missing = [];
  if (!wx) missing.push('Weather forecast has not been retrieved');
  if (!known(pitch.condition)) missing.push('Pitch condition is unknown');
  if (!known(pitch.outfield)) missing.push('Outfield speed is unknown');
  if (!fmt.id) missing.push('Match format is not set');
  if (!['bounce', 'seam', 'swing', 'spin', 'flat'].some((k) => known(pitch[k]))) missing.push('Pitch behaviour has not been recorded');
  if (!pitch.type) missing.push('Pitch type is not set');

  const hot = wx && wx.tempMax >= 30;
  const warm = wx && wx.tempMax >= 25;
  const cool = wx && wx.tempMax < 16;
  const windy = wx && (wx.wind >= 25 || (wx.gust ?? 0) >= 45);
  const breezy = wx && !windy && wx.wind >= 15;
  const humid = wx && wx.humidity >= 75;
  const overcast = wx && (wx.cloud >= 70 || [3, 45, 48].includes(wx.code));
  const wetPitch = ['Damp', 'Wet'].includes(pitch.condition);
  const dryPitch = ['Dry', 'Cracked'].includes(pitch.condition);
  const rainy = rain === 'likely' || rain === 'heavy';
  const showery = rain === 'possible';

  // ---------- Conditions analysis ----------
  const conditions = [];
  if (rainy || showery || wetPitch) {
    conditions.push({
      id: 'rain',
      title: rainy ? 'Rain and damp conditions' : wetPitch ? 'Damp surface' : 'Possible showers',
      tone: rain === 'heavy' ? 'danger' : 'warning',
      points: [
        'The ball may offer extra seam movement, depending on the surface and how much moisture is present.',
        'Bowlers will benefit from a consistent line and length rather than chasing wickets.',
        'Batting could become more difficult — value your wicket early on.',
        'A wet outfield is likely to be slower and the ball may get wet and harder to grip.',
        'Fielding and bowling plans may need adjusting if play is interrupted or overs are reduced.',
      ],
    });
  }
  if (hot || (warm && dryPitch && !rainy)) {
    conditions.push({
      id: 'hot',
      title: 'Hot and dry conditions',
      tone: 'caution',
      points: [
        'The pitch may dry out further as the day goes on.',
        'Spin could become more relevant if the surface offers turn.',
        'A dry ball can be easier for some spinners to grip.',
        'Batters should assess the surface before playing aggressive shots.',
        hot ? 'Heat will tire fast bowlers — use shorter spells and plan drinks breaks.' : null,
      ].filter(Boolean),
    });
  }
  if (windy || breezy) {
    conditions.push({
      id: 'wind',
      title: windy ? 'Strong winds' : 'Breezy conditions',
      tone: windy ? 'warning' : 'info',
      points: [
        `Wind from the ${compass(wx.windDir) || 'unknown direction'} at around ${Math.round(wx.wind)} km/h${wx.gust ? ` (gusts up to ${Math.round(wx.gust)} km/h)` : ''}.`,
        'Swing bowlers may be helped or hindered depending on which end they bowl from — try them into a cross-breeze.',
        'High catches will be harder to judge; position your safest catchers where the ball is likely to go up.',
        'Fielding positions may need adjusting for shots carried by the wind.',
        'Bowlers bowling into the wind may need a shorter spell.',
      ],
    });
  }
  if (overcast || humid) {
    conditions.push({
      id: 'overcast',
      title: overcast ? 'Overcast / humid' : 'Humid conditions',
      tone: 'info',
      points: [
        'Cloud cover and humidity can sometimes help the ball swing, particularly the new ball.',
        'This is not guaranteed — watch the first few overs to see how much it moves.',
      ],
    });
  }
  if (cool) {
    conditions.push({
      id: 'cool',
      title: 'Cool conditions',
      tone: 'info',
      points: ['A thorough warm-up is important to avoid strains, especially for bowlers.', 'The ball may not grip as well for spinners if the surface is damp and cold.'],
    });
  }
  if (wx && rain === 'clear' && !hot && !windy && !conditions.length) {
    conditions.push({
      id: 'fine',
      title: 'Settled conditions',
      tone: 'good',
      points: ['No major weather concerns are expected. How the pitch plays will matter more than the weather.'],
    });
  }

  // ---------- Pace vs spin ----------
  let pace = 50;
  let spin = 50;
  const paceWhy = [];
  const spinWhy = [];
  if (wetPitch) {
    pace += 18;
    spin -= 10;
    paceWhy.push(`The pitch is ${pitch.condition.toLowerCase()}; moisture often helps seam bowlers.`);
    spinWhy.push('A damp surface usually gives spinners less grip.');
  }
  if (pitch.condition === 'Dry') {
    spin += 15;
    pace -= 5;
    spinWhy.push('A dry pitch can offer grip and turn, especially later in the day.');
  }
  if (pitch.condition === 'Cracked') {
    spin += 20;
    pace += 5;
    spinWhy.push('Cracks can give spinners variable turn.');
    paceWhy.push('Cracks can produce uneven bounce for quicker bowlers hitting the deck.');
  }
  if (pitch.condition === 'Hard') {
    pace += 10;
    paceWhy.push('A hard surface usually gives pace and carry.');
  }
  if (pitch.condition === 'Soft') {
    pace -= 8;
    spin += 4;
    paceWhy.push('A soft surface tends to slow the ball down, reducing the effect of pace.');
  }
  const bump = (v, big, small, neg) => (v === 'Yes' ? big : v === 'Somewhat' ? small : v === 'No' ? neg : 0);
  if (known(pitch.seam)) {
    pace += bump(pitch.seam, 18, 9, -8);
    paceWhy.push(`You recorded seam movement as "${pitch.seam}".`);
  }
  if (known(pitch.swing)) {
    pace += bump(pitch.swing, 12, 6, -4);
    paceWhy.push(`You recorded swing as "${pitch.swing}".`);
  }
  if (known(pitch.bounce)) {
    pace += bump(pitch.bounce, 10, 5, -5);
    paceWhy.push(`You recorded bounce as "${pitch.bounce}".`);
  }
  if (known(pitch.spin)) {
    spin += bump(pitch.spin, 25, 12, -15);
    spinWhy.push(`You recorded spin as "${pitch.spin}".`);
  }
  if (pitch.flat === 'Yes') {
    pace -= 5;
    spin -= 5;
    paceWhy.push('The pitch looks flat — bowlers of all types may find it hard work; control will matter most.');
  }
  if (overcast || humid) {
    pace += 8;
    paceWhy.push('Cloud cover / humidity may assist swing with the new ball.');
  }
  if (rainy) {
    pace += 5;
    spin -= 5;
    paceWhy.push('Rain is likely, which can keep moisture in the surface.');
    spinWhy.push('A wet ball is harder for spinners to grip.');
  }
  if (hot && !rainy) {
    spin += 10;
    pace -= 4;
    spinWhy.push('Hot, dry weather can dry the surface out and bring spin into play.');
    paceWhy.push('Heat will tire fast bowlers — keep spells short.');
  }
  if (pitch.type === 'Synthetic') {
    spin += 4;
    spinWhy.push('Synthetic pitches usually give consistent bounce, which can help spinners who bowl with over-spin.');
  }
  if (fmt.id === 'T20') {
    spinWhy.push('In T20 cricket, a spinner who can control the run rate is often valuable in the middle overs.');
  }
  if (pitch.groundSize === 'Small') {
    spin -= 4;
    spinWhy.push('A small ground punishes flighted deliveries — spinners need good control.');
  }
  pace = clamp(pace);
  spin = clamp(spin);
  const paceSpinInputs = [wx, known(pitch.condition), ...['seam', 'swing', 'bounce', 'spin', 'flat'].map((k) => known(pitch[k]))].filter(Boolean).length;
  const enoughForBowling = paceSpinInputs >= 1;

  let balance;
  if (!enoughForBowling) balance = 'Not enough information yet. Record the pitch condition or retrieve the weather to get a recommendation.';
  else if (pace - spin >= 15) balance = 'Lean towards pace. Use your stronger seam bowlers early and keep spin as a change-up.';
  else if (spin - pace >= 15) balance = 'Lean towards spin. Consider including an extra spinner and bringing spin on earlier than usual.';
  else balance = 'A balanced attack. Start with pace and introduce spin once you have seen how the surface is playing.';

  // Personalise with the squad's actual bowlers (roster at the time for finished matches).
  const roster = match?.rosterSnapshot || players || [];
  const paceNames = roster.filter((p) => isPace(p.bowling) && p.name?.trim()).map((p) => p.name);
  const spinNames = roster.filter((p) => isSpin(p.bowling) && p.name?.trim()).map((p) => p.name);
  const squadNotes = [];
  if (roster.some((p) => p.bowling)) {
    if (paceNames.length) squadNotes.push(`Your pace options: ${paceNames.join(', ')}.`);
    if (spinNames.length) squadNotes.push(`Your spin options: ${spinNames.join(', ')}.`);
    if (enoughForBowling && spin - pace >= 15 && !spinNames.length) squadNotes.push('Conditions may suit spin, but no spinners are listed in your team. Slower, cutting deliveries from your seamers could do a similar job.');
    if (enoughForBowling && pace - spin >= 15 && !paceNames.length) squadNotes.push('Conditions may suit seam, but no pace bowlers are listed in your team.');
    const openers = (match.bowling || []).filter((r) => r.playerId).slice(0, 2);
    const byId = (id) => roster.find((p) => p.id === id);
    if (enoughForBowling && pace - spin >= 15 && openers.length === 2 && openers.every((r) => isSpin(byId(r.playerId)?.bowling))) {
      squadNotes.push(`Your planned opening bowlers (${openers.map((r) => playerName(roster, match, r.playerId)).join(' and ')}) are both spinners, while conditions may favour seam early.`);
    }
    if (enoughForBowling && spin - pace >= 15 && spinNames.length && !(match.bowling || []).some((r) => spinNames.includes(playerName(roster, match, r.playerId)))) {
      squadNotes.push(`None of your spinners (${spinNames.join(', ')}) are in the bowling plan yet.`);
    }
  } else {
    squadNotes.push('Add bowling styles in Player Management to see which of your players suit these conditions.');
  }

  const bowling = {
    squad: { pace: paceNames, spin: spinNames, notes: squadNotes },
    enough: enoughForBowling,
    pace: { score: pace, level: levelOf(pace), reasons: paceWhy.length ? paceWhy : ['No specific information favours or counts against pace yet.'] },
    spin: { score: spin, level: levelOf(spin), reasons: spinWhy.length ? spinWhy : ['No specific information favours or counts against spin yet.'] },
    balance,
    paceText:
      pace >= 65
        ? 'Conditions may favour seam bowling. Consider using your stronger pace bowlers early while there is help in the surface or air.'
        : pace >= 45
          ? 'Pace bowling should be effective if bowlers hit a consistent line and length.'
          : 'Conditions may offer limited help to pace bowlers. Control and variations will be important.',
    spinText:
      spin >= 65
        ? 'If the pitch is dry and offers grip, spin bowling may become increasingly useful. Consider including a spinner who can maintain consistent control.'
        : spin >= 45
          ? 'Spin may play a supporting role. Watch how much the ball grips before relying on it.'
          : 'Conditions may not suit spin. Use spinners carefully, mainly to change the pace of the game.',
  };

  // ---------- Toss ----------
  let bowlFirst = 0;
  const tossWhy = [];
  const uncertain = [];
  if (rainy) {
    bowlFirst += 2;
    tossWhy.push('Rain is likely. If overs are reduced, the team batting second usually knows exactly what target it needs — depending on your competition’s rain rules.');
  } else if (showery) {
    bowlFirst += 1;
    tossWhy.push('Showers are possible, which could interrupt the match and favour the team chasing a known target.');
  }
  if (wetPitch || pitch.seam === 'Yes') {
    bowlFirst += 2;
    tossWhy.push('The surface may help seam bowlers early while there is moisture in it.');
  }
  if (overcast || humid) {
    bowlFirst += 1;
    tossWhy.push('Overcast or humid conditions may help the new ball swing early.');
  }
  if (dryPitch || pitch.spin === 'Yes') {
    bowlFirst -= 2;
    tossWhy.push('A dry or turning pitch may get harder to bat on later, so batting first could be an advantage.');
  }
  if (pitch.flat === 'Yes' || pitch.condition === 'Hard') {
    bowlFirst -= 1;
    tossWhy.push('A firm, flat surface may allow your team to set a competitive total.');
  }
  if (hot && !rainy) {
    bowlFirst -= 1;
    tossWhy.push('In hot conditions, fielding first in the heat of the day can tire your bowlers before they bat.');
  }
  if (wx?.dewRisk) {
    bowlFirst += 1;
    tossWhy.push('Dew may form later in the day, making the ball wet and harder to grip for the side bowling second.');
  }
  if (history.chasingTrend === 'Chasing teams usually win') {
    bowlFirst += 1;
    tossWhy.push(`Ground history: chasing teams usually win here${history.source ? ` (source: ${history.source})` : ' (your record)'}.`);
  } else if (history.chasingTrend === 'Batting-first teams usually win') {
    bowlFirst -= 1;
    tossWhy.push(`Ground history: teams batting first usually win here${history.source ? ` (source: ${history.source})` : ' (your record)'}.`);
  }
  if (history.avgFirstInnings) {
    tossWhy.push(`Recorded average first-innings score at this ground: ${history.avgFirstInnings}${history.source ? ` (source: ${history.source})` : ' (your record)'}.`);
  }
  if (!wx) uncertain.push('The weather has not been retrieved yet.');
  if (!known(pitch.condition)) uncertain.push('The pitch condition is unknown — inspect it at the ground.');
  if (wx && wx.kind === 'forecast' && wx.daysAhead > 3) uncertain.push('The forecast is several days away and may change.');
  uncertain.push('Always reassess the pitch and weather at the ground before making the final decision.');

  let tossSuggestion = 'No strong preference';
  let tossText = 'The available information does not clearly favour batting or bowling first. Inspect the pitch at the ground and decide based on your team’s strengths.';
  if (bowlFirst >= 2) {
    tossSuggestion = 'Consider Bowling First';
    tossText = 'Conditions may help the side bowling first, or rain may make chasing a known target easier. Reassess the pitch and weather at the ground before making the final decision.';
  } else if (bowlFirst <= -2) {
    tossSuggestion = 'Consider Batting First';
    tossText = 'Conditions are expected to suit batting first. If the pitch is firm and consistent, batting first may allow your team to establish a competitive total.';
  }
  const toss = { suggestion: tossSuggestion, text: tossText, reasons: tossWhy, uncertainties: uncertain, score: bowlFirst };

  // ---------- Outfield ----------
  let outfieldSpeed = pitch.outfield || 'Unknown';
  const outfieldNotes = [];
  let batting = [];
  let fieldingPts = [];
  if (outfieldSpeed === 'Fast') {
    batting = ['Shots that pierce the gaps are more likely to reach the boundary.', 'Good placement can produce more boundaries — look for gaps rather than power.'];
    fieldingPts = ['Protect the boundary more carefully — consider extra sweepers in the main scoring areas.', 'Fielders need to cut off the ball early; one misfield can cost four.'];
  } else if (outfieldSpeed === 'Slow') {
    batting = ['Some shots that would normally reach the boundary may stop short.', 'Batters should run hard between the wickets — twos and threes will be important.', 'Hitting in the air may be needed for boundaries.'];
    fieldingPts = ['Fielders have more time to intercept the ball, so you can bring some fielders in to save singles.', 'Attack the ball to stop batters turning ones into twos.'];
  } else if (outfieldSpeed === 'Average') {
    batting = ['Expect normal value for shots — rotate the strike and punish loose balls.'];
    fieldingPts = ['A standard balance of inner-ring and boundary fielders should work.'];
  } else {
    batting = ['Outfield speed is unknown. Watch the first few shots along the ground to judge it.'];
    fieldingPts = ['Check the outfield during the warm-up and adjust fielding depth accordingly.'];
  }
  if (rainy && outfieldSpeed !== 'Slow') outfieldNotes.push('Rain is likely, so the outfield may play slower than usual.');
  if (pitch.groundSize === 'Small') outfieldNotes.push('The ground is small — mishits can still carry for six; keep fielders deep in the main hitting areas.');
  if (pitch.groundSize === 'Large') outfieldNotes.push('The ground is large — running hard between wickets is rewarded; deep fielders must cover a lot of ground.');
  const outfield = { speed: outfieldSpeed, batting, fielding: fieldingPts, notes: outfieldNotes };

  // ---------- Fielding considerations ----------
  const fielding = [];
  if (pace >= 65 && enoughForBowling) fielding.push('With help for seam bowlers, consider extra slips and a gully early on.');
  if (spin >= 65 && enoughForBowling) fielding.push('If the ball is turning, consider close catchers such as Short Leg and Silly Point for your spinners.');
  if (windy) fielding.push('In strong wind, place your safest catchers where skied shots are likely to drift.');
  fieldingPts.forEach((p) => fielding.push(p));
  const observations = md.scoring || [];
  const weightByArea = {};
  observations.forEach((o) => {
    weightByArea[o.area] = (weightByArea[o.area] || 0) + (Number(o.weight) || 1);
  });
  const hotAreas = Object.entries(weightByArea)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([area]) => area);
  const areaSuggestions = hotAreas.map((area) => ({
    area,
    areaName: SCORING_AREA_BY_ID[area]?.name || area,
    positions: (AREA_PROTECTION[area] || []).map((id) => POSITION_BY_ID[id]?.name).filter(Boolean),
    positionIds: AREA_PROTECTION[area] || [],
    sourced: observations.some((o) => o.area === area && o.kind === 'sourced'),
  }));
  areaSuggestions.forEach((s) =>
    fielding.push(`Scoring area noted at ${s.areaName}${s.sourced ? ' (sourced data)' : ' (your observation)'}: consider protecting it with ${s.positions.slice(0, 3).join(', ')}.`)
  );

  // ---------- Risks ----------
  const risks = [];
  if (rain === 'heavy') risks.push('Heavy rain could reduce or abandon the match.');
  else if (rainy) risks.push('Rain interruptions and reduced overs are likely.');
  else if (showery) risks.push('Showers could interrupt play.');
  if (hot) risks.push(`Heat (up to ${Math.round(wx.tempMax)}°C) — risk of fatigue and dehydration.`);
  if (windy) risks.push('Strong wind will make high catches and bowling into the wind harder.');
  if (wetPitch || rainy) risks.push('A wet outfield may be slippery for fielders and make the ball hard to grip.');
  if (wx?.dewRisk) risks.push('Possible dew later in the day affecting grip for bowlers.');
  if (pitch.condition === 'Cracked') risks.push('Uneven bounce from cracks — batters need to watch the ball closely.');
  if (missing.length >= 3) risks.push('Several pieces of information are missing, so these recommendations are limited.');

  // ---------- Preparation ----------
  const prep = [];
  if (!wx) prep.push('Retrieve the weather forecast closer to the match.');
  else if (wx.kind === 'forecast' && wx.daysAhead > 2) prep.push('Refresh the forecast the day before the match.');
  if (rainy || showery) prep.push('Pack towels, spare grips and sawdust; confirm the competition’s rain rules.');
  if (hot) prep.push('Bring plenty of water, sunscreen and hats; plan drinks breaks.');
  if (!known(pitch.condition)) prep.push('Inspect the pitch on arrival and update the pitch condition here.');
  if (spin >= 65 && enoughForBowling) prep.push('Make sure your spinners get a good warm-up bowling at a single stump.');
  if (pace >= 65 && enoughForBowling) prep.push('Prepare your opening bowlers to attack early; practise slip catching in the warm-up.');
  if (outfieldSpeed === 'Slow') prep.push('Practise quick running between the wickets.');
  prep.push('Walk the ground and check the boundary sizes and any short sides.');

  // ---------- Summary ----------
  const overall = wx
    ? `${wx.kind === 'historical' ? 'Recorded conditions were' : 'Conditions are expected to be'} ${wx.conditions.toLowerCase()}, ${Math.round(wx.tempMin)}–${Math.round(wx.tempMax)}°C${
        wx.rainProb != null ? ` with a ${Math.round(wx.rainProb)}% peak chance of rain` : ''
      }${wx.rainTotal >= 0.1 ? ` and about ${wx.rainTotal.toFixed(1)} mm of rain during match hours` : ''}. Wind around ${Math.round(wx.wind)} km/h from the ${compass(wx.windDir)}.`
    : 'The weather has not been retrieved yet.';
  const pitchText = known(pitch.condition) || pitch.type
    ? `${pitch.type ? `${pitch.type} pitch` : 'Pitch'}${known(pitch.condition) ? `, currently ${pitch.condition.toLowerCase()}` : ''}. ${
        pitch.flat === 'Yes' ? 'It looks flat and good for batting.' : pitch.seam === 'Yes' ? 'It may help seam bowlers.' : pitch.spin === 'Yes' ? 'It may offer turn.' : 'Assess how it plays in the first few overs.'
      }`
    : 'The pitch has not been described yet. Inspect it at the ground.';
  const battingText = [
    pitch.flat === 'Yes' ? 'The surface looks good for batting — aim to build a big total.' : 'Assess the pitch before committing to an aggressive approach.',
    outfieldSpeed === 'Slow' ? 'Rotate the strike and run hard — the outfield is slow.' : outfieldSpeed === 'Fast' ? 'Look for gaps — the fast outfield rewards placement.' : null,
    pace >= 65 && enoughForBowling ? 'Expect early movement; openers should leave well and play late.' : null,
  ]
    .filter(Boolean)
    .join(' ');

  const summary = [
    { id: 'overall', title: 'Weather outlook', text: overall },
    { id: 'pitch', title: 'Pitch expectations', text: pitchText },
    { id: 'bowling', title: 'Pace vs spin', text: bowling.balance },
    { id: 'toss', title: 'Batting or bowling first', text: `${toss.suggestion}. ${toss.reasons[0] || toss.text}` },
    { id: 'outfield', title: 'Outfield conditions', text: `${outfieldSpeed === 'Unknown' ? 'Outfield speed unknown.' : `${outfieldSpeed} outfield.`} ${[...outfieldNotes, batting[0]].filter(Boolean).join(' ')}` },
    { id: 'batting', title: 'Batting strategy', text: battingText },
    { id: 'fielding', title: 'Fielding considerations', text: fielding.slice(0, 3).join(' ') || 'Use a standard field and adjust once you see how the pitch plays.' },
    { id: 'risks', title: 'Potential match-day risks', text: risks.length ? risks.join(' ') : 'No significant risks identified from the information available.' },
    { id: 'prep', title: 'Suggested preparation', text: prep.slice(0, 4).join(' ') },
  ];

  return { missing, conditions, bowling, toss, outfield, fielding, areaSuggestions, risks, prep, summary, rain, format: fmt };
}
