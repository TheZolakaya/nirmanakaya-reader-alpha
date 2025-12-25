// === CLICKABLE TERM COMPONENT ===
// Must be used inside a component that has access to setSelectedInfo

import { CHANNELS, HOUSES, ROLES, STATUS_INFO } from '../../lib/constants.js';
import { getComponent } from '../../lib/corrections.js';

const ClickableTermContext = ({ type, id, children, setSelectedInfo }) => {
  const handleClick = (e) => {
    e.stopPropagation();
    let data = null;
    if (type === 'card') {
      data = getComponent(id);
    } else if (type === 'channel') {
      data = CHANNELS[id];
    } else if (type === 'status') {
      data = STATUS_INFO[id];
    } else if (type === 'house') {
      data = HOUSES[id];
    } else if (type === 'role') {
      data = ROLES[id];
    }
    setSelectedInfo({ type, id, data });
  };

  return (
    <span
      className="cursor-pointer hover:underline decoration-dotted underline-offset-2"
      onClick={handleClick}
    >
      {children}
    </span>
  );
};

export default ClickableTermContext;
