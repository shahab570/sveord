import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Shield, User } from "lucide-react";
import { toast } from "sonner";

interface UserProfile {
    id: string;
    email: string | null;
    first_name: string | null;
    last_name: string | null;
    is_approved: boolean | null;
    created_at?: string;
}

export default function AdminDashboard() {
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchUsers = async () => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .order('is_approved', { ascending: true }); // Pending (false) first

            if (error) throw error;
            setUsers(data || []);
        } catch (error) {
            console.error('Error fetching users:', error);
            toast.error("Failed to load users");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const toggleApproval = async (userId: string, currentStatus: boolean | null) => {
        const newStatus = !currentStatus;
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ is_approved: newStatus })
                .eq('id', userId);

            if (error) throw error;

            toast.success(`User ${newStatus ? 'approved' : 'blocked'} successfully`);

            // Update local state
            setUsers(users.map(u =>
                u.id === userId ? { ...u, is_approved: newStatus } : u
            ));
        } catch (error) {
            console.error('Error updating user:', error);
            toast.error("Failed to update user status");
        }
    };

    return (
        <AppLayout>
            <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold flex items-center gap-2">
                            <Shield className="h-8 w-8 text-primary" />
                            Admin Dashboard
                        </h1>
                        <p className="text-muted-foreground mt-2">
                            Manage user access and approvals.
                        </p>
                    </div>
                    <div className="bg-primary/10 px-4 py-2 rounded-full">
                        <span className="font-semibold text-primary">{users.length}</span> Total Users
                    </div>
                </div>

                <div className="border rounded-lg bg-card shadow-sm">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>User</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-8">
                                        Loading users...
                                    </TableCell>
                                </TableRow>
                            ) : users.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-8">
                                        No users found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                users.map((user) => (
                                    <TableRow key={user.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center">
                                                    <User className="h-4 w-4 text-muted-foreground" />
                                                </div>
                                                <span className="font-medium">
                                                    {user.first_name || '—'} {user.last_name || ''}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {user.email || <span className="italic text-xs">No email synced</span>}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={user.is_approved ? "default" : "destructive"}>
                                                {user.is_approved ? "Approved" : "Pending"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {user.email === 'mjsahab570@gmail.com' ? (
                                                <span className="text-xs text-muted-foreground italic">Admin</span>
                                            ) : (
                                                <Button
                                                    size="sm"
                                                    variant={user.is_approved ? "outline" : "default"}
                                                    onClick={() => toggleApproval(user.id, user.is_approved)}
                                                    className="gap-2"
                                                >
                                                    {user.is_approved ? (
                                                        <>
                                                            <XCircle className="h-4 w-4" /> Block
                                                        </>
                                                    ) : (
                                                        <>
                                                            <CheckCircle className="h-4 w-4" /> Approve
                                                        </>
                                                    )}
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </AppLayout>
    );
}
