import { dispatchKeyEvent, DispatchKeyEventArgs } from './useChipKeyboard';

type MockHandlers = {
  handleType: jest.Mock;
  handlePick: jest.Mock;
  handleRemoveLast: jest.Mock;
  handleFinalize: jest.Mock;
  handleCancel: jest.Mock;
};

type EventRecorder = {
  preventDefault: jest.Mock;
  stopPropagation: jest.Mock;
};

const makeHandlers = (): MockHandlers => ({
  handleType: jest.fn(),
  handlePick: jest.fn(),
  handleRemoveLast: jest.fn(),
  handleFinalize: jest.fn(),
  handleCancel: jest.fn(),
});

const makeEvent = (key: string): EventRecorder & { key: string } => ({
  key,
  preventDefault: jest.fn(),
  stopPropagation: jest.fn(),
});

const makeArgs = (overrides: {
  inputValue?: string;
  pickedValue?: string;
  isMulti?: boolean;
  hasMultiValues?: boolean;
  handlers?: MockHandlers;
  onNavigate?: jest.Mock;
}): DispatchKeyEventArgs => ({
  state: {
    inputValue: overrides.inputValue ?? '',
    pickedValue: overrides.pickedValue ?? '',
  },
  ctx: {
    isMulti: overrides.isMulti ?? false,
    hasMultiValues: overrides.hasMultiValues ?? false,
  },
  handlers: overrides.handlers ?? makeHandlers(),
  onNavigate: overrides.onNavigate ?? jest.fn().mockReturnValue(false),
});

describe('dispatchKeyEvent', () => {
  describe('Backspace', () => {
    it('in multi with empty input and existing values → calls handleRemoveLast and preventDefault', () => {
      const handlers = makeHandlers();
      const event = makeEvent('Backspace');
      dispatchKeyEvent(
        makeArgs({ isMulti: true, inputValue: '', hasMultiValues: true, handlers }),
        event as unknown as React.KeyboardEvent
      );
      expect(handlers.handleRemoveLast).toHaveBeenCalledTimes(1);
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('in multi with no multi values → does nothing', () => {
      const handlers = makeHandlers();
      const event = makeEvent('Backspace');
      dispatchKeyEvent(
        makeArgs({ isMulti: true, inputValue: '', hasMultiValues: false, handlers }),
        event as unknown as React.KeyboardEvent
      );
      expect(handlers.handleRemoveLast).not.toHaveBeenCalled();
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it('in multi with non-empty input → does nothing (native backspace edits text)', () => {
      const handlers = makeHandlers();
      const event = makeEvent('Backspace');
      dispatchKeyEvent(
        makeArgs({ isMulti: true, inputValue: 'abc', hasMultiValues: true, handlers }),
        event as unknown as React.KeyboardEvent
      );
      expect(handlers.handleRemoveLast).not.toHaveBeenCalled();
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it('in single mode → does nothing', () => {
      const handlers = makeHandlers();
      const event = makeEvent('Backspace');
      dispatchKeyEvent(
        makeArgs({ isMulti: false, inputValue: '', handlers }),
        event as unknown as React.KeyboardEvent
      );
      expect(handlers.handleRemoveLast).not.toHaveBeenCalled();
    });
  });

  describe('Arrow keys', () => {
    it('delegates ArrowDown to onNavigate when it returns true', () => {
      const handlers = makeHandlers();
      const onNavigate = jest.fn().mockReturnValue(true);
      const event = makeEvent('ArrowDown');
      dispatchKeyEvent(
        makeArgs({ handlers, onNavigate }),
        event as unknown as React.KeyboardEvent
      );
      expect(onNavigate).toHaveBeenCalledWith(event);
      // No business handlers fired when navigation consumed the event
      expect(handlers.handlePick).not.toHaveBeenCalled();
      expect(handlers.handleFinalize).not.toHaveBeenCalled();
    });

    it('delegates ArrowUp to onNavigate', () => {
      const handlers = makeHandlers();
      const onNavigate = jest.fn().mockReturnValue(true);
      const event = makeEvent('ArrowUp');
      dispatchKeyEvent(
        makeArgs({ handlers, onNavigate }),
        event as unknown as React.KeyboardEvent
      );
      expect(onNavigate).toHaveBeenCalledWith(event);
    });
  });

  describe('Enter', () => {
    it('with pickedValue → handlePick(pickedValue) + preventDefault + stopPropagation', () => {
      const handlers = makeHandlers();
      const event = makeEvent('Enter');
      dispatchKeyEvent(
        makeArgs({ pickedValue: 'foo', handlers }),
        event as unknown as React.KeyboardEvent
      );
      expect(handlers.handlePick).toHaveBeenCalledWith('foo');
      expect(handlers.handleFinalize).not.toHaveBeenCalled();
      expect(event.preventDefault).toHaveBeenCalled();
      expect(event.stopPropagation).toHaveBeenCalled();
    });

    it('in multi without pickedValue → handleFinalize', () => {
      const handlers = makeHandlers();
      const event = makeEvent('Enter');
      dispatchKeyEvent(
        makeArgs({ isMulti: true, pickedValue: '', handlers }),
        event as unknown as React.KeyboardEvent
      );
      expect(handlers.handleFinalize).toHaveBeenCalledTimes(1);
      expect(handlers.handlePick).not.toHaveBeenCalled();
    });

    it("in single without pickedValue → handlePick('') to preserve contract", () => {
      const handlers = makeHandlers();
      const event = makeEvent('Enter');
      dispatchKeyEvent(
        makeArgs({ isMulti: false, pickedValue: '', handlers }),
        event as unknown as React.KeyboardEvent
      );
      expect(handlers.handlePick).toHaveBeenCalledWith('');
    });
  });

  describe('Escape', () => {
    it('calls handleCancel and stopPropagation', () => {
      const handlers = makeHandlers();
      const event = makeEvent('Escape');
      dispatchKeyEvent(
        makeArgs({ handlers }),
        event as unknown as React.KeyboardEvent
      );
      expect(handlers.handleCancel).toHaveBeenCalledTimes(1);
      expect(event.stopPropagation).toHaveBeenCalled();
      // Escape does not preventDefault
      expect(event.preventDefault).not.toHaveBeenCalled();
    });
  });

  describe('Tab', () => {
    it('in multi with pickedValue → handlePick then handleFinalize (in that order)', () => {
      const handlers = makeHandlers();
      const event = makeEvent('Tab');
      const callOrder: string[] = [];
      handlers.handlePick.mockImplementation(() => callOrder.push('pick'));
      handlers.handleFinalize.mockImplementation(() => callOrder.push('finalize'));

      dispatchKeyEvent(
        makeArgs({ isMulti: true, pickedValue: 'foo', handlers }),
        event as unknown as React.KeyboardEvent
      );

      expect(handlers.handlePick).toHaveBeenCalledWith('foo');
      expect(handlers.handleFinalize).toHaveBeenCalledTimes(1);
      expect(callOrder).toEqual(['pick', 'finalize']);
      expect(event.preventDefault).toHaveBeenCalled();
      expect(event.stopPropagation).toHaveBeenCalled();
    });

    it('in multi without pickedValue → only handleFinalize', () => {
      const handlers = makeHandlers();
      const event = makeEvent('Tab');
      dispatchKeyEvent(
        makeArgs({ isMulti: true, pickedValue: '', handlers }),
        event as unknown as React.KeyboardEvent
      );
      expect(handlers.handlePick).not.toHaveBeenCalled();
      expect(handlers.handleFinalize).toHaveBeenCalledTimes(1);
    });

    it('in single with pickedValue → handlePick(pickedValue) only', () => {
      const handlers = makeHandlers();
      const event = makeEvent('Tab');
      dispatchKeyEvent(
        makeArgs({ isMulti: false, pickedValue: 'bar', handlers }),
        event as unknown as React.KeyboardEvent
      );
      expect(handlers.handlePick).toHaveBeenCalledWith('bar');
      expect(handlers.handleFinalize).not.toHaveBeenCalled();
    });

    it("in single without pickedValue → handlePick('') (preserves current contract)", () => {
      const handlers = makeHandlers();
      const event = makeEvent('Tab');
      dispatchKeyEvent(
        makeArgs({ isMulti: false, pickedValue: '', handlers }),
        event as unknown as React.KeyboardEvent
      );
      expect(handlers.handlePick).toHaveBeenCalledWith('');
      expect(handlers.handleFinalize).not.toHaveBeenCalled();
    });
  });

  describe('Unhandled keys', () => {
    it("ordinary character keys don't fire any handler", () => {
      const handlers = makeHandlers();
      const event = makeEvent('a');
      dispatchKeyEvent(
        makeArgs({ handlers }),
        event as unknown as React.KeyboardEvent
      );
      expect(handlers.handleType).not.toHaveBeenCalled();
      expect(handlers.handlePick).not.toHaveBeenCalled();
      expect(handlers.handleFinalize).not.toHaveBeenCalled();
      expect(handlers.handleCancel).not.toHaveBeenCalled();
      expect(handlers.handleRemoveLast).not.toHaveBeenCalled();
      expect(event.preventDefault).not.toHaveBeenCalled();
    });
  });
});
