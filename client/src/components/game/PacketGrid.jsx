const statusLabel = {
  acked: 'ACK',
  dropped: 'DROP',
  inFlight: 'FLY',
  empty: ''
};

function PacketGrid({ packets, windowSize }) {
  const visibleCells = Math.max(24, Math.min(96, Math.ceil(windowSize / 8) * 8));
  const cells = [
    ...packets,
    ...Array.from({ length: Math.max(0, visibleCells - packets.length) }, (_, index) => ({
      id: `empty-${index}`,
      state: 'empty',
      sequence: ''
    }))
  ];

  return (
    <div className="packet-grid-wrap">
      <div className="packet-grid-meta">
        <span>Window size: {Math.round(windowSize)} packets</span>
        <span>{packets.length ? 'Latest tick window' : 'Waiting for first tick'}</span>
      </div>

      <div className="packet-grid" aria-label="TCP packet visualizer">
        {cells.map((packet) => (
          <div
            key={packet.id}
            className={`packet-cell packet-${packet.state}`}
            title={packet.sequence ? `Packet #${packet.sequence} · ${packet.state}` : ''}
          >
            {statusLabel[packet.state]}
          </div>
        ))}
      </div>

      <div className="packet-legend">
        <span><i className="legend-box in-flight" /> In-flight</span>
        <span><i className="legend-box acked" /> Acknowledged</span>
        <span><i className="legend-box dropped" /> Dropped</span>
      </div>
    </div>
  );
}

export default PacketGrid;