import React, { useState } from 'react';

export default function PropertyChat({ propertyId }) {
	const [text, setText] = useState('');
	const [messages, setMessages] = useState([]);

	async function send() {
		const form = new FormData();
		form.append('text', text);
		const res = await fetch('/api/schedule', { method: 'POST', body: form });
		const json = await res.json();
		setMessages(m => [...m, { from: 'user', text }, { from: 'agent', text: JSON.stringify(json.analysis, null, 2) }]);
		setText('');
	}

	return (
		<div style={{ border: '1px solid #ddd', padding: 8 }}>
			<div style={{ height: 160, overflow: 'auto', background: '#fff' }}>
				{messages.map((m, i) => (
					<div key={i} style={{ padding: 6, textAlign: m.from === 'user' ? 'right' : 'left' }}>
						<div style={{ display: 'inline-block', background: m.from === 'user' ? '#def' : '#eee', padding: 6, borderRadius: 6 }}>{m.text}</div>
					</div>
				))}
			</div>
			<textarea value={text} onChange={e => setText(e.target.value)} style={{ width: '100%', marginTop: 8 }} />
			<div style={{ marginTop: 6 }}>
				<button onClick={send}>Send to agent</button>
			</div>
		</div>
	);
}

