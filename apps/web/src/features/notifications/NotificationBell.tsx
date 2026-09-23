import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Badge,
  ClickAwayListener,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Popper,
  Typography,
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import { listNotifications, markNotificationRead, type Notification } from '../../api-client.js';
import { describeNotificationType, getNotificationLink } from './notification-target.js';

function formatDate(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

/**
 * DEVOS-271: the mockup's static bell badge (`Design/DevOS.dc.html:102-105`)
 * wired to Sprint 42's real `GET /notifications`/`PATCH /notifications/:id/read`
 * routes. Fetches on mount and on each open — no polling, matching this
 * codebase's existing no-polling convention (`App.tsx`'s own `getHealth()`
 * check also only runs once).
 */
export function NotificationBell() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const anchorRef = useRef<HTMLButtonElement>(null);

  function refresh() {
    setLoading(true);
    listNotifications().then((result) => {
      setLoading(false);
      if (result.ok) {
        setError(null);
        setNotifications(result.data);
      } else {
        setError(result.error.message);
      }
    });
  }

  useEffect(refresh, []);

  const unreadCount = notifications.filter((notification) => !notification.read).length;

  function close() {
    setOpen(false);
  }

  function toggle() {
    setOpen((current) => {
      const next = !current;
      if (next) refresh();
      return next;
    });
  }

  function handleSelect(notification: Notification) {
    const link = getNotificationLink(notification.referenceType, notification.referenceId);
    if (!notification.read) markNotificationRead(notification.id).then(refresh);
    if (link) {
      close();
      navigate(link);
    }
  }

  return (
    <ClickAwayListener onClickAway={close}>
      <div style={{ position: 'relative' }}>
        <IconButton
          ref={anchorRef}
          data-testid="notification-bell"
          color="inherit"
          onClick={toggle}
          aria-label="Notifications"
        >
          <Badge badgeContent={unreadCount} color="error">
            <NotificationsIcon />
          </Badge>
        </IconButton>
        <Popper
          open={open}
          anchorEl={anchorRef.current}
          placement="bottom-end"
          style={{ zIndex: 1400, width: 360 }}
        >
          <Paper variant="outlined" sx={{ mt: 0.5, maxHeight: 420, overflowY: 'auto' }}>
            {loading && (
              <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                Loading…
              </Typography>
            )}
            {!loading && error && (
              <Typography variant="body2" color="error" sx={{ p: 2 }}>
                Failed to load notifications: {error}
              </Typography>
            )}
            {!loading && !error && notifications.length === 0 && (
              <Typography
                data-testid="notification-list-empty"
                variant="body2"
                color="text.secondary"
                sx={{ p: 2 }}
              >
                No notifications.
              </Typography>
            )}
            {!loading && !error && notifications.length > 0 && (
              <List dense disablePadding data-testid="notification-list">
                {notifications.map((notification) => {
                  const link = getNotificationLink(
                    notification.referenceType,
                    notification.referenceId,
                  );
                  const label = describeNotificationType(notification.type);
                  return link ? (
                    <ListItemButton
                      key={notification.id}
                      data-testid="notification-item"
                      onClick={() => handleSelect(notification)}
                    >
                      <ListItemText
                        primary={label}
                        secondary={formatDate(notification.createdAt)}
                        slotProps={{
                          primary: { fontWeight: notification.read ? 400 : 700 },
                        }}
                      />
                    </ListItemButton>
                  ) : (
                    <div key={notification.id} style={{ padding: '8px 16px' }}>
                      <Typography
                        variant="body2"
                        fontWeight={notification.read ? 400 : 700}
                        data-testid="notification-item-unlinked"
                      >
                        {label}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatDate(notification.createdAt)} — no detail view available.
                      </Typography>
                    </div>
                  );
                })}
              </List>
            )}
          </Paper>
        </Popper>
      </div>
    </ClickAwayListener>
  );
}
