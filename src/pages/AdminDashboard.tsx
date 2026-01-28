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
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    CheckCircle,
    XCircle,
    Shield,
    User,
    Search,
    Trash2,
    AlertTriangle
} from "lucide-react";
import { toast } from "sonner";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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
    const [searchTerm, setSearchTerm] = useState("");

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

    const deleteUser = async (userId: string) => {
        try {
            const { error } = await supabase
                .from('profiles')
                .delete()
                .eq('id', userId);

            if (error) throw error;

            toast.success("User profile deleted");

            // Update local state
            setUsers(users.filter(u => u.id !== userId));
        } catch (error) {
            console.error('Error deleting user:', error);
            toast.error("Failed to delete user");
        }
    };

    const filteredUsers = users.filter(user => {
        const searchLower = searchTerm.toLowerCase();
        const email = user.email?.toLowerCase() || "";
        const name = `${user.first_name || ""} ${user.last_name || ""}`.toLowerCase();
        return email.includes(searchLower) || name.includes(searchLower);
    });

    return (
        <AppLayout>
            <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold flex items-center gap-2">
                            <Shield className="h-8 w-8 text-primary" />
                            Admin Dashboard
                        </h1>
                        <p className="text-muted-foreground mt-2">
                            Manage user access, approve new accounts, or remove unwanted users.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative w-full md:w-64">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search user or email..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-8"
                            />
                        </div>
                        <div className="bg-primary/10 px-4 py-2 rounded-full whitespace-nowrap">
                            <span className="font-semibold text-primary">{users.length}</span> Users
                        </div>
                    </div>
                </div>

                <div className="border rounded-lg bg-card shadow-sm">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>User Details</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center py-8">
                                        Loading users...
                                    </TableCell>
                                </TableRow>
                            ) : filteredUsers.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center py-8">
                                        No users found matching "{searchTerm}".
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredUsers.map((user) => (
                                    <TableRow key={user.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                                                    <User className="h-5 w-5 text-muted-foreground" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-foreground">
                                                        {user.email || <span className="italic text-muted-foreground">No email synced</span>}
                                                    </span>
                                                    {(user.first_name || user.last_name) && (
                                                        <span className="text-xs text-muted-foreground">
                                                            {user.first_name} {user.last_name}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={user.is_approved ? "default" : "destructive"}>
                                                {user.is_approved ? "Approved" : "Pending"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {user.email === 'mjsahab570@gmail.com' ? (
                                                <span className="text-xs text-muted-foreground italic pr-4">Admin</span>
                                            ) : (
                                                <div className="flex items-center justify-end gap-2">
                                                    <Button
                                                        size="sm"
                                                        variant={user.is_approved ? "outline" : "default"}
                                                        onClick={() => toggleApproval(user.id, user.is_approved)}
                                                        className="gap-2 h-8"
                                                    >
                                                        {user.is_approved ? (
                                                            <>
                                                                <XCircle className="h-3.5 w-3.5" /> Block
                                                            </>
                                                        ) : (
                                                            <>
                                                                <CheckCircle className="h-3.5 w-3.5" /> Approve
                                                            </>
                                                        )}
                                                    </Button>

                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Delete User?</AlertDialogTitle>
                                                                <AlertDialogDescription>
                                                                    Are you sure you want to delete <strong>{user.email || 'this user'}</strong>?
                                                                    Their profile data and progress will be removed from the app.
                                                                    <div className="mt-2 text-amber-600 flex items-center gap-2 text-xs bg-amber-50 p-2 rounded">
                                                                        <AlertTriangle className="h-4 w-4" />
                                                                        Note: This does not delete their Google Login account, only their app profile.
                                                                    </div>
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                <AlertDialogAction onClick={() => deleteUser(user.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                                                    Delete
                                                                </AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </div>
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
