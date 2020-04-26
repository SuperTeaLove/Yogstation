import { toFixed } from 'common/math';
import { decodeHtmlEntities } from 'common/string';
import { Fragment } from 'inferno';
import { useBackend } from '../backend';
import { Box, Button, LabeledList, NumberInput, Section, ProgressBar } from '../components';
import { InterfaceLockNoticeBox } from './common/InterfaceLockNoticeBox';
import { classes } from 'common/react';

const STATE_INOPEN = 0;
const STATE_INOPENING = 1;
const STATE_INCLOSING = 2;
const STATE_CLOSED = 3;
const STATE_OUTCLOSING = 4;
const STATE_OUTOPENING = 5;
const STATE_OUTOPEN = 6;
const STATE_DOCKED = -1;
const STATE_ERROR = -2;

const ROLE_INT_PRESSURIZE = 1;
const ROLE_INT_DEPRESSURIZE = 2;
const ROLE_EXT_PRESSURIZE = 4;
const ROLE_EXT_DEPRESSURIZE = 8;

export const AdvancedAirlockController = props => {
  const { state } = props;
  const { act, data } = useBackend(props);
  const locked = data.locked && !data.siliconUser;
  return (
    <Fragment>
      <InterfaceLockNoticeBox
        siliconUser={data.siliconUser}
        locked={data.locked}
        onLockStatusChange={() => act('lock')} />
      <AACStatus state={state} />
      {!locked && (
        <AACControl state={state} />
      )}
    </Fragment>
  );
};

const AACStatus = props => {
  const { act, data } = useBackend(props);
  const stateMap = {
    [STATE_INOPEN]: {
      color: 'good',
      localStatusText: 'Cycled to interior',
    },
    [STATE_INOPENING]: {
      color: 'average',
      localStatusText: 'Pressurizing (interior)',
    },
    [STATE_INCLOSING]: {
      color: 'average',
      localStatusText: 'Depressurizing (interior)',
    },

    [STATE_OUTOPEN]: {
      color: 'good',
      localStatusText: 'Cycled to exterior',
    },
    [STATE_OUTOPENING]: {
      color: 'average',
      localStatusText: 'Pressurizing (exterior)',
    },
    [STATE_OUTCLOSING]: {
      color: 'average',
      localStatusText: 'Depressurizing (exterior)',
    },

    [STATE_CLOSED]: {
      color: 'average',
      localStatusText: 'Unknown',
    },
    [STATE_DOCKED]: {
      color: 'good',
      localStatusText: 'Shuttle Docked',
    },
    [STATE_ERROR]: {
      color: 'bad',
      localStatusText: 'Error. Contact an atmospheric technician for assistance.',
    },
  };
  const localStatus = stateMap[data.cyclestate] || stateMap[0];
  return (
    <Section title="Airlock Status">
      <LabeledList>
        <Fragment>
          <LabeledList.Item
            label="Pressure">
            <ProgressBar
              ranges={{
                good: [0.75, Infinity],
                average: [0.25, 0.75],
                bad: [-Infinity, 0.25],
              }}
              value={data.pressure / data.maxpressure}>
              {toFixed(data.pressure, 2)} kPa
            </ProgressBar>
          </LabeledList.Item>
          <LabeledList.Item
            label="Status"
            color={localStatus.color}>
            {localStatus.localStatusText}
          </LabeledList.Item>
          {!!data.emagged && (
            <LabeledList.Item
              label="Warning"
              color="bad">
              Safety measures offline. Device may exhibit abnormal behavior.
            </LabeledList.Item>
          )}
        </Fragment>
      </LabeledList>
      {(data.cyclestate === STATE_INOPEN || data.cyclestate === STATE_CLOSED
      || data.cyclestate === STATE_INOPENING || data.cyclestate === STATE_OUTCLOSING) && <Button
        icon="sync-alt"
        content="Cycle to Exterior"
        onClick={() => act('cycle', {
          exterior: 1,
        })} />}
      {(data.cyclestate === STATE_OUTOPEN || data.cyclestate === STATE_CLOSED
      || data.cyclestate === STATE_OUTOPENING || data.cyclestate === STATE_INCLOSING) && <Button
        icon="sync-alt"
        content="Cycle to Interior"
        onClick={() => act('cycle', {
          exterior: 0,
        })} />}
      {(data.cyclestate === STATE_OUTOPENING || data.cyclestate === STATE_INOPENING
      || data.cyclestate === STATE_OUTCLOSING || data.cyclestate === STATE_INCLOSING) && <Button
        ico n="forward"
        content={"Skip "
          + ((data.cyclestate === STATE_OUTOPENING || data.cyclestate === STATE_INOPENING)
            ? "pressurization"
            : "depressurization")
          + ((data.skip_timer < data.skip_delay)
            ? " (in " + Math.round((data.skip_delay - data.skip_timer)/10) + " seconds)"
            : "")}
        color="danger"
        disabled={data.skip_timer < data.skip_delay}
        onClick={() => act('skip')}
      />}
    </Section>
  );
};

const AACControl = props => {
  const { state } = props;
  const { data, act } = useBackend(props);
  /* Why not use NoticeBox? because its fucking broken and doesnt work
  thanks tg */
  return (
    <Section title="Configuration">
      {(data.cyclestate === STATE_ERROR && !!data.config_error_str)
        && <Box className={classes(['NoticeBox'])}>{data.config_error_str}</Box>}
      <LabeledList>
        <LabeledList.Item label="Actions"><Button
          icon="search"
          content="Scan for Devices"
          onClick={() => act('scan')} />
        </LabeledList.Item>
        <LabeledList.Item label="Interior Pressure">
          <NumberInput
            animated
            value={parseFloat(data.interior_pressure)}
            unit="kPa"
            width="125px"
            minValue={0}
            maxValue={102}
            step={1}
            onChange={(e, value) => act('interior_pressure', {
              pressure: value,
            })} />
        </LabeledList.Item>
        <LabeledList.Item label="Exterior Pressure">
          <NumberInput
            animated
            value={parseFloat(data.exterior_pressure)}
            unit="kPa"
            width="125px"
            minValue={0}
            maxValue={101.325}
            step={1}
            onChange={(e, value) => act('exterior_pressure', {
              pressure: value,
            })} />
        </LabeledList.Item>
        <LabeledList.Item label="Depressurization Margin">
          <NumberInput
            animated
            value={parseFloat(data.depressurization_margin)}
            unit="kPa"
            width="125px"
            minValue={0.15}
            maxValue={40}
            step={1}
            onChange={(e, value) => act('depressurization_margin', {
              pressure: value,
            })} />
        </LabeledList.Item>
        <LabeledList.Item label="Time before Skip Allowed">
          <NumberInput
            animated
            value={Math.round(parseFloat(data.skip_delay))/10}
            unit="seconds"
            width="125px"
            minValue={0}
            maxValue={120}
            step={1}
            onChange={(e, value) => act('skip_delay', {
              skip_delay: value * 10,
            })} />
        </LabeledList.Item>
      </LabeledList>

      {(!data.vents || data.vents.length === 0)
        ? (<Box className={classes(['NoticeBox'])}>No vents</Box>)
        : data.vents.map(vent => (
          <Vent key={vent.vent_id}
            state={state}
            {...vent} />))}
      {(!data.airlocks || data.airlocks.length === 0)
        ? (<Box className={classes(['NoticeBox'])}>No Airlocks</Box>)
        : data.airlocks.map(airlock => (
          <Airlock key={airlock.airlock_id}
            state={state}
            {...airlock} />))}
    </Section>
  );
};

const Vent = props => {
  const {
    vent_id,
    name,
    role,
  } = props;
  const { act, data } = useBackend(props);
  return (
    <Section
      level={2}
      title={decodeHtmlEntities(name)}
      buttons={(<Button 
        content="Show Hologram"
        selected={data.vis_target === vent_id}
        onClick={() => act(data.vis_target === vent_id ? 'clear_vis' : 'set_vis_vent', {
          vent_id,
        })} />)}>
      <LabeledList>
        <LabeledList.Item label="Roles">
          <Button
            icon="sign-out-alt"
            content="Int. Pressurize"
            selected={!!(role & ROLE_INT_PRESSURIZE)}
            onClick={() => act('toggle_role', {
              vent_id,
              val: ROLE_INT_PRESSURIZE,
            })} />
          <Button
            icon="sign-in-alt"
            content="Int. Depressurize"
            selected={!!(role & ROLE_INT_DEPRESSURIZE)}
            onClick={() => act('toggle_role', {
              vent_id,
              val: ROLE_INT_DEPRESSURIZE,
            })} />
          <Button
            icon="sign-out-alt"
            content="Ext. Pressurize"
            selected={!!(role & ROLE_EXT_PRESSURIZE)}
            onClick={() => act('toggle_role', {
              vent_id,
              val: ROLE_EXT_PRESSURIZE,
            })} />
          <Button
            icon="sign-in-alt"
            content="Ext. Depressurize"
            selected={!!(role & ROLE_EXT_DEPRESSURIZE)}
            onClick={() => act('toggle_role', {
              vent_id,
              val: ROLE_EXT_DEPRESSURIZE,
            })} />
        </LabeledList.Item>
      </LabeledList>
    </Section>
  );
};

const Airlock = props => {
  const {
    airlock_id,
    name,
    role,
    access,
  } = props;
  const { act, data } = useBackend(props);
  return (
    <Section
      level={2}
      title={decodeHtmlEntities(name)}
      buttons={(<Button 
        content="Show Hologram"
        selected={data.vis_target === airlock_id}
        onClick={() => act(data.vis_target === airlock_id ? 'clear_vis' : 'set_vis_airlock', {
          airlock_id,
        })} />)}>
      <LabeledList>
        <LabeledList.Item label="Roles">
          <Button
            icon="sign-in-alt"
            content="Interior"
            selected={!role}
            onClick={() => act('set_airlock_role', {
              airlock_id,
              val: 0,
            })} />
          <Button
            icon="sign-out-alt"
            content="Exterior"
            selected={!!role}
            onClick={() => act('set_airlock_role', {
              airlock_id,
              val: 1,
            })} />
        </LabeledList.Item>
        <LabeledList.Item label="Access">{access}</LabeledList.Item>
      </LabeledList>
    </Section>
  );
};
