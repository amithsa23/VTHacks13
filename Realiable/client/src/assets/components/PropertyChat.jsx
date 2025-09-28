import React, { useState } from 'react';

const API = import.meta.env.DEV ? 'http://localhost:4000/api' : '/api';

function AnalysisView({ analysis }) {
	if (!analysis) return <div>No analysis</div>;
	const isMock = analysis.note && String(analysis.note).toLowerCase().includes('sample analysis');
	return (
		<div>
			{isMock && <div style={{ color: '#a00', marginBottom: 8 }}>Agent offline — showing sample analysis</div>}
			<div><strong>Fits schedule:</strong> {analysis.fitsSchedule ? 'Yes' : 'No'}</div>
			{analysis.travelEstimates && (
				<div style={{ marginTop: 6 }}>
					<strong>Travel estimates</strong>
					<ul>
						{Object.entries(analysis.travelEstimates).map(([k, v]) => <li key={k}>{k}: {v}</li>)}
					</ul>
				</div>
			)}
			{analysis.nearby && (
				<div style={{ marginTop: 6 }}>
					<strong>Nearby</strong>
					{Object.entries(analysis.nearby).map(([k, list]) => (
						<div key={k}><em>{k}</em>
							<ul>{Array.isArray(list) ? list.map((it, i) => <li key={i}>{it.name} — {it.distanceMiles} mi</li>) : <li>{String(list)}</li>}</ul>
						</div>
					))}
				</div>
			)}
			{analysis.note && <div style={{ marginTop: 8 }}><strong>Note:</strong> {analysis.note}</div>}
		</div>
	);
}

export default function PropertyChat({ propertyId }) {
	const [text, setText] = useState('');
	const [messages, setMessages] = useState([]);
	const [loading, setLoading] = useState(false);

	async function send() {
		if (!text) return;
		setLoading(true);
		setMessages(m => [...m, { from: 'user', text }]);
		try {
			const res = await fetch(`${API}/schedule`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, propertyId }) });
			const json = await res.json();
			setMessages(m => [...m, { from: 'agent', analysis: json.analysis }]);
		} catch (e) {
			setMessages(m => [...m, { from: 'agent', error: 'Failed to contact agent' }]);
		} finally {
			setLoading(false);
			setText('');
		}
	}

	return (
		<div style={{ border: '1px solid #ddd', padding: 8 }}>
			<div style={{ height: 220, overflow: 'auto', background: '#fff', padding: 6 }}>
				{messages.map((m, i) => (
					<div key={i} style={{ padding: 6, textAlign: m.from === 'user' ? 'right' : 'left' }}>
						{m.from === 'user' && <div style={{ display: 'inline-block', background: '#def', padding: 6, borderRadius: 6 }}>{m.text}</div>}
						{m.from === 'agent' && (
							<div style={{ display: 'inline-block', background: '#eee', padding: 6, borderRadius: 6, maxWidth: '100%' }}>
								{m.error && <div style={{ color: 'crimson' }}>{m.error}</div>}
								{m.analysis && <AnalysisView analysis={m.analysis} />}
							</div>
						)}
					</div>
				))}
			</div>
			<textarea value={text} onChange={e => setText(e.target.value)} style={{ width: '100%', marginTop: 8 }} />
			<div style={{ marginTop: 6 }}>
				<button onClick={send} disabled={loading}>{loading ? 'Sending…' : 'Send to agent'}</button>
			</div>
		</div>
	);
}

